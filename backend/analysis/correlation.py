import math

def calculate_pearson(x: list[float], y: list[float]) -> float | None:
    """
    Computes Pearson correlation coefficient.
    Returns None if insufficient data (< 3 points) or if either variable is constant.
    """
    if len(x) != len(y) or len(x) < 3:
        return None
        
    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)
    
    numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    
    var_x = sum((xi - mean_x) ** 2 for xi in x)
    var_y = sum((yi - mean_y) ** 2 for yi in y)
    
    if var_x == 0 or var_y == 0:
        return None
        
    return numerator / math.sqrt(var_x * var_y)
