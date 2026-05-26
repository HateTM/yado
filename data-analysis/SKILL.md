---
name: data-analysis
description: Analyze data files and generate insights. Use when working with CSV, Excel, or JSON data files that need exploration, cleaning, or visualization.
---

# Data Analysis

When analyzing data files, follow this process:

## 1. Understand the Data
- Read a sample of the file to understand its structure
- Identify column types and data quality issues
- Note any missing values or anomalies

## 2. Ask Clarifying Questions
Before diving in, ask the user:
- What specific insights are they looking for?
- Are there any known data quality issues?
- What format do they want for the output?

## 3. Perform Analysis
Use pandas for data manipulation:

import pandas as pd

# Load and explore
df = pd.read_csv("data.csv")
print(df.head())
print(df.describe())
print(df.info())

For visualization, prefer matplotlib or seaborn depending on complexity.