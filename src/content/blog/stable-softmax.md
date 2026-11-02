---
title: 'Sample post: a numerically stable softmax'
description: A placeholder post that shows code blocks, math and the table of contents, using softmax with temperature as the example.
date: 2026-10-28
tags: [machine learning, python, math]
draft: false
---

> **Placeholder.** This sample post shows how code, math and the table of contents
> render. Replace it with your own writing or delete the file.

The softmax turns a vector of scores $z \in \mathbb{R}^K$ into a probability
distribution. With a temperature $T > 0$ it is

$$
\operatorname{softmax}(z)_i = \frac{e^{z_i / T}}{\sum_{j=1}^{K} e^{z_j / T}}.
$$

## What the temperature does

As $T \to 0$ the output approaches a one-hot vector on the largest score, and as
$T \to \infty$ it approaches the uniform distribution $1/K$. Sampling from a
language model at a low temperature is therefore more deterministic, and at a high
temperature more varied.

## Why the naive version overflows

In 64-bit floating point, $e^{x}$ overflows to infinity once $x$ exceeds about
$709$, so scores like $1000$ give $\infty / \infty$, which is `nan`.

### Shifting by the maximum

Adding the same constant to every score does not change the softmax, so subtract
the largest one, $m = \max_j z_j$:

$$
\operatorname{softmax}(z)_i = \frac{e^{(z_i - m)/T}}{\sum_{j} e^{(z_j - m)/T}}.
$$

Now every exponent is at most $0$, so nothing overflows, and the largest term is
exactly $1$, so the sum never underflows to zero.

## Code

```python
import numpy as np


def softmax(z: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    """Numerically stable softmax over the last axis."""
    shifted = (z - z.max(axis=-1, keepdims=True)) / temperature
    exp = np.exp(shifted)
    return exp / exp.sum(axis=-1, keepdims=True)


print(softmax(np.array([1000.0, 1001.0, 1002.0])))
# [0.09003057 0.24472847 0.66524096]
```

The same trick gives a stable log-softmax,
$\log \operatorname{softmax}(z)_i = z_i - m - \log \sum_j e^{z_j - m}$,
which is what cross-entropy losses use internally.
