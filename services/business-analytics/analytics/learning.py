from math import fsum
from statistics import fmean


def lag_regression(history, horizon, lag, *, nonnegative=False):
    """Fit ridge regression on the recent level and a lagged observation."""
    def features(series, index):
        recent = [v for v in series[index - 4:index] if v is not None]
        lagged = series[index - lag]
        if lagged is None or len(recent) < 3:
            return None
        return fmean(recent), lagged

    samples = []
    for i in range(max(4, lag), len(history)):
        pair = features(history, i)
        if pair is not None and history[i] is not None:
            samples.append((*pair, history[i]))
    if len(samples) < 12:
        return None
    x0, z0, y0 = map(fmean, zip(*samples))
    centered = [(x - x0, z - z0, y - y0) for x, z, y in samples]
    # Penalize standardized coefficients by 10% of the feature sum of squares.
    xx = 1.1 * fsum(x*x for x, _, _ in centered)
    zz = 1.1 * fsum(z*z for _, z, _ in centered)
    xz = fsum(x*z for x, z, _ in centered)
    xy = fsum(x*y for x, _, y in centered)
    zy = fsum(z*y for _, z, y in centered)
    determinant = xx*zz - xz*xz
    if determinant > 0:
        recent_weight = (zz*xy - xz*zy) / determinant
        season_weight = (xx*zy - xz*xy) / determinant
    else:
        recent_weight = xy / xx if xx else 0
        season_weight = zy / zz if zz else 0
    path = list(history)
    for _ in range(horizon):
        pair = features(path, len(path))
        if pair is None:
            return None
        x, z = pair
        estimate = y0 + recent_weight*(x - x0) + season_weight*(z - z0)
        path.append(max(0, estimate) if nonnegative else estimate)
    return path[-horizon:]
