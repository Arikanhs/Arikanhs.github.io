---
title: GCN-driven CUDA tuning for triangle counting
summary: A graph convolutional network that picks CUDA launch parameters, such as the block size, for parallel triangle counting, trained on kernel timings measured across real-world graphs.
date: 2025-09-01 # Placeholder: set the real date.
tags: [CUDA, GNN, HPC, Python]
repo: https://github.com/Arikanhs/ml_cuda
cover: ../../assets/projects/gcn-cuda.jpg
featured: true
order: 2
---

Research code behind the HPEC 2025 paper *GCN-Driven CUDA Parameter Optimization
for Parallel Triangle Counting in Graphs*.

## The idea

Triangle counting on the GPU runs at different speeds depending on the CUDA block
size, and the best setting changes from graph to graph. Instead of searching for it
on every new graph, a graph convolutional network learns to predict it from the
graph itself.

## What is in the repository

- `code/`: triangle counting timed under different CUDA block sizes, with Makefiles
  and CMake files for building against Kokkos.
- `gnn/`: the graph neural network (Python, NetworkX) and a script to run it on a
  cluster.
- `inputs/`: scripts that normalize dataset formats and download the graphs used in
  the experiments (about 100).

> **Placeholder.** Add results, figures and the steps to reproduce them.
