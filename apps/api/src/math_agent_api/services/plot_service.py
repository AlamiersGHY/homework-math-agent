import ast
import math
import re
from collections.abc import Callable

from math_agent_api.schemas.common import PlotType
from math_agent_api.schemas.plots import PlotPreviewRequest, PlotPreviewResponse


class PlotValidationError(Exception):
    pass


ALLOWED_FUNCTIONS: dict[str, Callable[..., float]] = {
    "abs": abs,
    "acos": math.acos,
    "asin": math.asin,
    "atan": math.atan,
    "cos": math.cos,
    "cosh": math.cosh,
    "exp": math.exp,
    "log": math.log,
    "log10": math.log10,
    "sin": math.sin,
    "sinh": math.sinh,
    "sqrt": math.sqrt,
    "tan": math.tan,
    "tanh": math.tanh,
}
ALLOWED_CONSTANTS = {"e": math.e, "pi": math.pi}
DEFAULT_PARAMETER_VALUES = {"a": 1.0}
MAX_SAMPLES_2D = 120
MAX_SAMPLES_3D_AXIS = 35
FUNCTION_ALIASES = {"ln": "log"}


def create_plot_preview(request: PlotPreviewRequest) -> PlotPreviewResponse:
    normalized_request = _normalize_plot_request(request)
    if normalized_request.plot_type == PlotType.FUNCTION2D:
        return _create_function2d(normalized_request)
    if normalized_request.plot_type == PlotType.SURFACE3D:
        return _create_surface3d(normalized_request)
    if normalized_request.plot_type == PlotType.REGION2D:
        return _create_region2d(normalized_request)
    if normalized_request.plot_type == PlotType.IMPLICIT3D:
        return _create_implicit3d(normalized_request)
    raise PlotValidationError("This plot type is not implemented in the MVP preview yet.")


def _normalize_plot_request(request: PlotPreviewRequest) -> PlotPreviewRequest:
    return request.model_copy(update={"expression": normalize_plot_expression(request.expression)})


def normalize_plot_expression(expression: str) -> str:
    normalized = expression.strip()
    if normalized.count("{") != normalized.count("}"):
        raise PlotValidationError("Expression has incomplete LaTeX braces.")
    normalized = (
        normalized.replace("\\(", " ")
        .replace("\\)", " ")
        .replace("\\[", " ")
        .replace("\\]", " ")
        .replace("$", " ")
        .replace("＝", "=")
        .replace("，", ",")
        .replace("。", ".")
    )
    normalized = normalized.replace("\\left", "").replace("\\right", "")
    normalized = _replace_latex_sqrt(normalized)
    normalized = re.sub(r"\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}", r"((\1)/(\2))", normalized)
    normalized = re.sub(r"\^\s*\{([^{}]+)\}", r"^(\1)", normalized)
    normalized = re.sub(r"_\s*\{([^{}]+)\}", r"_\1", normalized)
    normalized = normalized.replace("{", "(").replace("}", ")")
    normalized = re.sub(r"\\([A-Za-z]+)", r"\1", normalized)
    for alias, target in FUNCTION_ALIASES.items():
        normalized = re.sub(rf"\b{alias}\b", target, normalized)
    if normalized.count("=") == 1 and re.match(r"^\s*[xyz]\s*=", normalized, flags=re.IGNORECASE):
        normalized = normalized.split("=", 1)[1]
    normalized = re.sub(r"(\d)([A-Za-z(])", r"\1*\2", normalized)
    normalized = re.sub(r"([xyz])(?=[xyz])", r"\1*", normalized)
    normalized = re.sub(r"\b(sin|cos|tan|sqrt|log|ln|exp)\s+([A-Za-z0-9(])", r"\1(\2", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" .;:,")
    if normalized.count("(") > normalized.count(")"):
        normalized += ")" * (normalized.count("(") - normalized.count(")"))
    return normalized


def _replace_latex_sqrt(expression: str) -> str:
    marker = "\\sqrt"
    index = expression.find(marker)
    while index >= 0:
        brace_start = expression.find("{", index + len(marker))
        if brace_start < 0:
            raise PlotValidationError("Expression has incomplete LaTeX square-root syntax.")
        brace_end = _find_matching_brace(expression, brace_start)
        if brace_end < 0:
            raise PlotValidationError("Expression has incomplete LaTeX square-root syntax.")
        inner = expression[brace_start + 1 : brace_end]
        expression = expression[:index] + f"sqrt({inner})" + expression[brace_end + 1 :]
        index = expression.find(marker, index + len(inner) + 6)
    return expression


def validate_plot_request(request: PlotPreviewRequest) -> PlotPreviewRequest:
    """Validate syntax without sampling a full Plotly grid."""
    normalized_request = _normalize_plot_request(request)
    variables = set(normalized_request.variables)
    if normalized_request.plot_type == PlotType.FUNCTION2D:
        if len(normalized_request.variables) != 1:
            raise PlotValidationError("function2d requires exactly one variable.")
        _compile_expression(normalized_request.expression, variables)
        return normalized_request
    if normalized_request.plot_type == PlotType.SURFACE3D:
        if len(normalized_request.variables) != 2:
            raise PlotValidationError("surface3d requires exactly two variables.")
        _compile_expression(normalized_request.expression, variables)
        return normalized_request
    if normalized_request.plot_type == PlotType.REGION2D:
        if len(normalized_request.variables) != 2:
            raise PlotValidationError("region2d requires exactly two variables.")
        return normalized_request
    if normalized_request.plot_type == PlotType.IMPLICIT3D:
        if len(normalized_request.variables) != 3:
            raise PlotValidationError("implicit3d requires exactly three variables.")
        if variables != {"x", "y", "z"}:
            raise PlotValidationError("implicit3d supports only x, y, and z variables.")
        expression, _level = _split_implicit_equation(normalized_request.expression)
        _compile_expression(expression, variables)
        return normalized_request
    raise PlotValidationError("This plot type is not implemented in the MVP preview yet.")


def _find_matching_brace(expression: str, start: int) -> int:
    depth = 0
    for index in range(start, len(expression)):
        if expression[index] == "{":
            depth += 1
        elif expression[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def _create_function2d(request: PlotPreviewRequest) -> PlotPreviewResponse:
    if len(request.variables) != 1:
        raise PlotValidationError("function2d requires exactly one variable.")
    variable = request.variables[0]
    start, end = _get_valid_range(request.ranges, variable)
    evaluator = _compile_expression(request.expression, {variable})
    xs = _linspace(start, end, MAX_SAMPLES_2D)
    ys = [_safe_eval(evaluator, {variable: x}) for x in xs]
    spec = {
        "data": [
            {
                "type": "scatter",
                "mode": "lines",
                "x": xs,
                "y": ys,
                "name": f"f({variable}) = {request.expression}",
                "line": {"color": "#047857", "width": 3},
            }
        ],
        "layout": {
            "title": {"text": f"f({variable}) = {request.expression}"},
            "xaxis": {"title": variable, "zeroline": True},
            "yaxis": {"title": "f", "zeroline": True},
            "margin": {"l": 48, "r": 20, "t": 48, "b": 44},
        },
        "config": {"responsive": True, "displaylogo": False},
    }
    return PlotPreviewResponse(
        plot_type=PlotType.FUNCTION2D,
        spec=spec,
        explanation=f"该图展示 ${request.expression}$ 在 {variable} 从 {start:g} 到 {end:g} 的变化趋势。",
    )


def _create_surface3d(request: PlotPreviewRequest) -> PlotPreviewResponse:
    if len(request.variables) != 2:
        raise PlotValidationError("surface3d requires exactly two variables.")
    x_name, y_name = request.variables
    x_start, x_end = _get_valid_range(request.ranges, x_name)
    y_start, y_end = _get_valid_range(request.ranges, y_name)
    evaluator = _compile_expression(request.expression, {x_name, y_name})
    xs = _linspace(x_start, x_end, MAX_SAMPLES_3D_AXIS)
    ys = _linspace(y_start, y_end, MAX_SAMPLES_3D_AXIS)
    z_grid = [
        [_safe_eval(evaluator, {x_name: x, y_name: y}) for x in xs]
        for y in ys
    ]
    spec = {
        "data": [
            {
                "type": "surface",
                "x": xs,
                "y": ys,
                "z": z_grid,
                "colorscale": "Viridis",
                "contours": {
                    "z": {
                        "show": True,
                        "usecolormap": True,
                        "highlightcolor": "#111827",
                        "project": {"z": True},
                    }
                },
            }
        ],
        "layout": {
            "title": {"text": f"z = {request.expression}"},
            "scene": {
                "xaxis": {"title": x_name},
                "yaxis": {"title": y_name},
                "zaxis": {"title": "z"},
                "camera": {"eye": {"x": 1.45, "y": 1.45, "z": 1.05}},
            },
            "margin": {"l": 0, "r": 0, "t": 48, "b": 0},
        },
        "config": {"responsive": True, "displaylogo": False},
    }
    return PlotPreviewResponse(
        plot_type=PlotType.SURFACE3D,
        spec=spec,
        explanation=(
            f"该曲面展示 $z={request.expression}$ 在 "
            f"{x_name}\\in[{x_start:g},{x_end:g}], {y_name}\\in[{y_start:g},{y_end:g}] 上的起伏。"
        ),
    )


def _create_region2d(request: PlotPreviewRequest) -> PlotPreviewResponse:
    if len(request.variables) != 2:
        raise PlotValidationError("region2d requires exactly two variables.")
    x_name, y_name = request.variables
    x_start, x_end = _get_valid_range(request.ranges, x_name)
    y_start, y_end = _get_valid_range(request.ranges, y_name)

    normalized = request.expression.replace(" ", "")
    if not _is_supported_triangular_region(normalized, x_name, y_name):
        raise PlotValidationError(
            "Only simple triangular regions like 0<=x<=1, 0<=y<=x are supported in the MVP preview."
        )

    xs = _linspace(x_start, x_end, 80)
    spec = {
        "data": [
            {
                "type": "scatter",
                "mode": "lines",
                "x": [x_start, x_end, x_end, x_start],
                "y": [y_start, y_start, y_end, y_start],
                "fill": "toself",
                "name": f"D: {request.expression}",
                "line": {"color": "#0f766e", "width": 2},
                "fillcolor": "rgba(20, 184, 166, 0.28)",
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": xs,
                "y": xs,
                "name": f"{y_name} = {x_name}",
                "line": {"color": "#334155", "width": 2, "dash": "dash"},
            },
        ],
        "layout": {
            "title": {"text": f"Region D: {request.expression}"},
            "xaxis": {
                "title": x_name,
                "range": [x_start - 0.05, x_end + 0.05],
                "zeroline": True,
                "scaleanchor": "y",
            },
            "yaxis": {
                "title": y_name,
                "range": [y_start - 0.05, y_end + 0.05],
                "zeroline": True,
            },
            "margin": {"l": 48, "r": 20, "t": 48, "b": 44},
        },
        "config": {"responsive": True, "displaylogo": False},
    }
    return PlotPreviewResponse(
        plot_type=PlotType.REGION2D,
        spec=spec,
        explanation=f"该区域图展示 ${request.expression}$ 的简单三角形积分区域。",
    )


def _is_supported_triangular_region(expression: str, x_name: str, y_name: str) -> bool:
    compact = expression.replace("，", ",")
    lower_y = f"0<={y_name}<={x_name}" in compact
    bounded_x = f"0<={x_name}<=1" in compact
    return lower_y and bounded_x


def _create_implicit3d(request: PlotPreviewRequest) -> PlotPreviewResponse:
    if len(request.variables) != 3:
        raise PlotValidationError("implicit3d requires exactly three variables.")
    x_name, y_name, z_name = request.variables
    if set(request.variables) != {"x", "y", "z"}:
        raise PlotValidationError("implicit3d supports only x, y, and z variables.")
    x_start, x_end = _get_valid_range(request.ranges, x_name)
    y_start, y_end = _get_valid_range(request.ranges, y_name)
    z_start, z_end = _get_valid_range(request.ranges, z_name)
    expression, level = _split_implicit_equation(request.expression)
    evaluator = _compile_expression(expression, {x_name, y_name, z_name})
    xs = _linspace(x_start, x_end, MAX_SAMPLES_3D_AXIS)
    ys = _linspace(y_start, y_end, MAX_SAMPLES_3D_AXIS)
    zs = _linspace(z_start, z_end, MAX_SAMPLES_3D_AXIS)
    x_values: list[float] = []
    y_values: list[float] = []
    z_values: list[float] = []
    scalar_values: list[float | None] = []
    for z in zs:
        for y in ys:
            for x in xs:
                x_values.append(x)
                y_values.append(y)
                z_values.append(z)
                value = _safe_eval(evaluator, {x_name: x, y_name: y, z_name: z})
                scalar_values.append(None if value is None else round(value - level, 6))
    valid_values = [value for value in scalar_values if value is not None]
    band = _iso_band(valid_values)
    spec = {
        "data": [
            {
                "type": "isosurface",
                "x": x_values,
                "y": y_values,
                "z": z_values,
                "value": scalar_values,
                "isomin": -band,
                "isomax": band,
                "surface": {"count": 1},
                "caps": {
                    "x": {"show": False},
                    "y": {"show": False},
                    "z": {"show": False},
                },
                "colorscale": "Viridis",
                "opacity": 0.72,
                "name": request.expression,
            }
        ],
        "layout": {
            "title": {"text": request.expression},
            "scene": {
                "xaxis": {"title": x_name},
                "yaxis": {"title": y_name},
                "zaxis": {"title": z_name},
                "aspectmode": "cube",
                "camera": {"eye": {"x": 1.45, "y": 1.45, "z": 1.15}},
            },
            "margin": {"l": 0, "r": 0, "t": 48, "b": 0},
        },
        "config": {"responsive": True, "displaylogo": False},
    }
    return PlotPreviewResponse(
        plot_type=PlotType.IMPLICIT3D,
        spec=spec,
        explanation=(
            f"Implicit surface preview for ${request.expression}$ using the zero level set "
            f"of {expression} - ({level:g})."
        ),
    )


def _split_implicit_equation(expression: str) -> tuple[str, float]:
    normalized = expression.replace("＝", "=").strip()
    if normalized.count("=") != 1:
        raise PlotValidationError("implicit3d expression must be a single equation.")
    left, right = [part.strip() for part in normalized.split("=", 1)]
    if not left or not right:
        raise PlotValidationError("implicit3d expression must include both sides of the equation.")
    if _expression_names(right):
        return f"({left}) - ({right})", 0.0
    level_evaluator = _compile_expression(right, set())
    level = _safe_eval(level_evaluator, {})
    if level is None:
        raise PlotValidationError("implicit3d equation level must be a finite number.")
    return left, level


def _expression_names(expression: str) -> set[str]:
    normalized = expression.replace("^", "**").strip()
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError:
        return set()
    reserved = set(ALLOWED_FUNCTIONS) | set(ALLOWED_CONSTANTS) | set(DEFAULT_PARAMETER_VALUES)
    return {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)} - reserved


def _get_valid_range(ranges: dict[str, tuple[float, float]], variable: str) -> tuple[float, float]:
    if variable not in ranges:
        raise PlotValidationError(f"Missing range for variable '{variable}'.")
    start, end = ranges[variable]
    if not math.isfinite(start) or not math.isfinite(end):
        raise PlotValidationError("Plot ranges must be finite.")
    if start >= end:
        raise PlotValidationError("Plot range start must be less than end.")
    if end - start > 1000:
        raise PlotValidationError("Plot range is too wide for the MVP preview.")
    return start, end


def _linspace(start: float, end: float, count: int) -> list[float]:
    step = (end - start) / (count - 1)
    return [round(start + step * index, 6) for index in range(count)]


def _iso_band(values: list[float]) -> float:
    if not values:
        raise PlotValidationError("Implicit surface sampling did not produce finite values.")
    min_value = min(values)
    max_value = max(values)
    if min_value > 0 or max_value < 0:
        raise PlotValidationError("Implicit surface level is outside the sampled range.")
    span = max_value - min_value
    band = max(span * 0.002, 1e-4)
    return round(band, 6)


def _compile_expression(expression: str, variables: set[str]):
    normalized = expression.replace("^", "**").strip()
    if not normalized:
        raise PlotValidationError("Expression is required.")
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError as exc:
        raise PlotValidationError("Expression is not valid syntax.") from exc

    parameter_names = _parameter_names(expression, variables)
    allowed_names = variables | parameter_names | set(ALLOWED_FUNCTIONS) | set(ALLOWED_CONSTANTS)
    for node in ast.walk(tree):
        _validate_node(node, allowed_names)

    compiled = compile(tree, "<plot-expression>", "eval")

    def evaluate(values: dict[str, float]) -> float:
        parameters = {name: DEFAULT_PARAMETER_VALUES[name] for name in parameter_names}
        namespace = {**ALLOWED_FUNCTIONS, **ALLOWED_CONSTANTS, **parameters, **values}
        return float(eval(compiled, {"__builtins__": {}}, namespace))

    return evaluate


def _parameter_names(expression: str, variables: set[str]) -> set[str]:
    normalized = expression.replace("^", "**").strip()
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError:
        return set()
    names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
    reserved = variables | set(ALLOWED_FUNCTIONS) | set(ALLOWED_CONSTANTS)
    parameters = names - reserved
    return parameters & set(DEFAULT_PARAMETER_VALUES)


def _validate_node(node: ast.AST, allowed_names: set[str]) -> None:
    allowed_nodes = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Call,
        ast.Name,
        ast.Load,
        ast.Constant,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Mod,
    )
    if not isinstance(node, allowed_nodes):
        raise PlotValidationError("Expression uses unsupported syntax.")
    if isinstance(node, ast.Name) and node.id not in allowed_names:
        raise PlotValidationError(f"Expression uses unsupported name '{node.id}'.")
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in ALLOWED_FUNCTIONS:
            raise PlotValidationError("Expression uses unsupported function.")
        if len(node.keywords) > 0:
            raise PlotValidationError("Expression functions cannot use keyword arguments.")
    if isinstance(node, ast.Constant) and not isinstance(node.value, int | float):
        raise PlotValidationError("Expression constants must be numeric.")


def _safe_eval(evaluator, values: dict[str, float]) -> float | None:
    try:
        result = evaluator(values)
    except (ArithmeticError, ValueError, OverflowError):
        return None
    if not math.isfinite(result):
        return None
    return round(result, 6)
