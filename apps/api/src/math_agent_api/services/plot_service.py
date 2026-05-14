import ast
import math
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
MAX_SAMPLES_2D = 120
MAX_SAMPLES_3D_AXIS = 35


def create_plot_preview(request: PlotPreviewRequest) -> PlotPreviewResponse:
    if request.plot_type == PlotType.FUNCTION2D:
        return _create_function2d(request)
    if request.plot_type == PlotType.SURFACE3D:
        return _create_surface3d(request)
    raise PlotValidationError("This plot type is not implemented in the MVP preview yet.")


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


def _compile_expression(expression: str, variables: set[str]):
    normalized = expression.replace("^", "**").strip()
    if not normalized:
        raise PlotValidationError("Expression is required.")
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError as exc:
        raise PlotValidationError("Expression is not valid syntax.") from exc

    allowed_names = variables | set(ALLOWED_FUNCTIONS) | set(ALLOWED_CONSTANTS)
    for node in ast.walk(tree):
        _validate_node(node, allowed_names)

    compiled = compile(tree, "<plot-expression>", "eval")

    def evaluate(values: dict[str, float]) -> float:
        namespace = {**ALLOWED_FUNCTIONS, **ALLOWED_CONSTANTS, **values}
        return float(eval(compiled, {"__builtins__": {}}, namespace))

    return evaluate


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
