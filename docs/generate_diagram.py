#!/usr/bin/env python3
"""Generate system overview diagram for GameWeb paper using matplotlib."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np

fig, ax = plt.subplots(1, 1, figsize=(18, 22))
ax.set_xlim(-2, 18)
ax.set_ylim(-0.5, 22)
ax.set_aspect('equal')
ax.axis('off')

# ============================================================
# Helper functions
# ============================================================
def draw_box(x, y, w, h, title, desc="", fill='white', lw=1.8, fontsize=9, title_fontsize=10.5):
    rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.12",
                          facecolor=fill, edgecolor='black', linewidth=lw)
    ax.add_patch(rect)
    if desc:
        ax.text(x + w/2, y + h*0.62, title, ha='center', va='center',
                fontsize=title_fontsize, fontweight='bold', family='serif')
        ax.text(x + w/2, y + h*0.3, desc, ha='center', va='center',
                fontsize=fontsize, family='serif', color='#444444')
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center',
                fontsize=title_fontsize, fontweight='bold', family='serif')
    return (x, y, w, h)

def draw_group(x, y, w, h, label):
    rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.08",
                          facecolor='none', edgecolor='black', linewidth=1.8, linestyle='--')
    ax.add_patch(rect)
    ax.text(x + w/2, y + h + 0.18, label, ha='center', va='bottom',
            fontsize=11.5, fontweight='bold', family='serif')

def arr(x1, y1, x2, y2, color='black', lw=1.6, style='->', ls='-', shrinkA=0, shrinkB=0):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls,
                                shrinkA=shrinkA, shrinkB=shrinkB))

def rightangle(points, color='black', lw=1.5, style='->', ls='-'):
    """Draw a path through points, arrow only on last segment."""
    for i in range(len(points)-1):
        s = style if i == len(points)-2 else '-'
        ax.annotate('', xy=points[i+1], xytext=points[i],
                    arrowprops=dict(arrowstyle=s, color=color, lw=lw, linestyle=ls))

# ============================================================
# Constants
# ============================================================
BH = 0.95   # box height
SP = 0.35   # vertical spacing between boxes

# ============================================================
# 1. USER INPUT (top center)
# ============================================================
draw_box(3.5, 20.2, 7, BH, "User Input",
         "(natural language description, physics mode, camera mode)")

# ============================================================
# 2. GENERATION PIPELINE (left column)
# ============================================================
PX, PW = 0.5, 6
py0 = 18.5  # top of first pipeline box

pipe_data = [
    ("Step 1: RAG Retrieval",
     "embed query → cosine similarity → top-K from D"),
    ("Step 2–3: Description & Schema",
     "LLM-enhanced description; entity type + sprite mapping"),
    ("Step 4–5: Rules & Controls",
     "collision rules, AI behaviors, input→action mapping"),
    ("Step 6: Map Generation (4-Layer)",
     "Feature → Blueprint → Concrete → Segmentation"),
    ("Step 7: Code Generation & Validation",
     "generate GameRules; static analysis + self-repair"),
]

pipe_pos = []
for i, (t, d) in enumerate(pipe_data):
    y = py0 - i * (BH + SP)
    draw_box(PX, y, PW, BH, t, d)
    pipe_pos.append(y)

# Pipeline group
draw_group(PX - 0.35, pipe_pos[-1] - 0.35, PW + 0.7,
           py0 + BH - pipe_pos[-1] + 0.7, "Generation Pipeline (Server)")

# Pipeline vertical arrows
pcx = PX + PW / 2
for i in range(len(pipe_pos)-1):
    arr(pcx, pipe_pos[i], pcx, pipe_pos[i+1] + BH)

# User Input → Pipeline
arr(7, 20.2, pcx, py0 + BH)

# ============================================================
# 3. EXTERNAL SERVICES (right-top)
# ============================================================
EX, EW = 11, 5
ey0 = 18.5

ext_data = [
    ("LLM Service", "OpenAI GPT-4o text generation", 'white'),
    ("Embedding Service", "text-embedding-3-small, 1536-dim", 'white'),
    ("Game Database D", "1500+ games with pre-computed embeddings", '#f0f0f0'),
]

ext_pos = []
for i, (t, d, f) in enumerate(ext_data):
    y = ey0 - i * (BH + SP)
    draw_box(EX, y, EW, BH, t, d, fill=f)
    ext_pos.append(y)

draw_group(EX - 0.35, ext_pos[-1] - 0.35, EW + 0.7,
           ey0 + BH - ext_pos[-1] + 0.7, "External Services")

# ============================================================
# Pipeline ↔ External arrows
# ============================================================
# Single thick bidirectional arrow from pipeline box to LLM (clean approach)
# Use a bracket-style: one arrow from pipeline right edge to LLM left edge

# RAG → Embedding
mid_y_rag = pipe_pos[0] + BH/2
mid_y_emb = ext_pos[1] + BH/2
rightangle([(PX+PW, mid_y_rag), (8.5, mid_y_rag), (8.5, mid_y_emb), (EX, mid_y_emb)],
           style='<->', lw=1.3)
ax.text(8.7, (mid_y_rag + mid_y_emb)/2, 'embed', fontsize=8, family='serif',
        style='italic', ha='left', va='center')

# RAG → Game DB (dashed retrieve)
mid_y_db = ext_pos[2] + BH/2
rightangle([(PX+PW, mid_y_rag - 0.15), (7.8, mid_y_rag - 0.15), (7.8, mid_y_db), (EX, mid_y_db)],
           style='->', lw=1.2, ls='--')
ax.text(7.5, (mid_y_rag + mid_y_db)/2 - 0.3, 'retrieve', fontsize=8, family='serif',
        style='italic', ha='right', va='center')

# Steps 2–7 → LLM: single collective arrow with brace
mid_y_llm = ext_pos[0] + BH/2
# Draw a vertical bar on the right side of pipeline, then arrow to LLM
brace_x = PX + PW + 0.3
brace_top = pipe_pos[1] + BH/2
brace_bot = pipe_pos[4] + BH/2
# Vertical line
ax.plot([brace_x, brace_x], [brace_bot, brace_top], color='black', lw=1.3)
# Small horizontal ticks
for i in range(1, 5):
    mid = pipe_pos[i] + BH/2
    ax.plot([PX+PW, brace_x], [mid, mid], color='black', lw=1.0)
# Arrow from brace midpoint to LLM
brace_mid_y = (brace_top + brace_bot) / 2
rightangle([(brace_x, brace_mid_y), (9.5, brace_mid_y), (9.5, mid_y_llm), (EX, mid_y_llm)],
           style='<->', lw=1.5)
ax.text(9.7, (brace_mid_y + mid_y_llm)/2 + 0.2, 'LLM calls', fontsize=8, family='serif',
        style='italic', ha='left', va='center')

# ============================================================
# 4. GAME ARTIFACTS (center)
# ============================================================
art_y = 12.4
draw_box(2, art_y, 8, BH, "Game Artifacts",
         "GameRules + MapData + GameDescription", fill='#e8e8e8', lw=2)

# Pipeline → Artifacts
arr(pcx, pipe_pos[-1], pcx, art_y + BH)

# ============================================================
# 5. GAME RUNTIME (right column)
# ============================================================
RX, RW_val = 11, 5
ry0 = 12.4

rt_data = [
    ("Loader Layer", "MapLoader, EntityFactory, ResourceManager"),
    ("Excalibur Engine Core", "GameEngine, GameModeManager (3 physics modes)"),
    ("Runtime Layer", "PhysicsManager, RuleExecutor, InputManager"),
    ("GameUtils API", "EntityWrapper: move, shoot, chase, patrol, die"),
]

rt_pos = []
for i, (t, d) in enumerate(rt_data):
    y = ry0 - i * (BH + SP)
    draw_box(RX, y, RW_val, BH, t, d)
    rt_pos.append(y)

draw_group(RX - 0.35, rt_pos[-1] - 0.35, RW_val + 0.7,
           ry0 + BH - rt_pos[-1] + 0.7, "Game Runtime (Browser)")

# Runtime vertical arrows
rcx = RX + RW_val / 2
for i in range(len(rt_pos)-1):
    arr(rcx, rt_pos[i], rcx, rt_pos[i+1] + BH)

# Artifacts → Loader
arr(10, art_y + BH/2, RX, ry0 + BH/2, lw=1.8)
ax.text(10.2, art_y + BH/2 + 0.15, 'load', fontsize=8.5, family='serif',
        style='italic', ha='left', va='bottom')

# ============================================================
# 6. USER / PLAYER (bottom center)
# ============================================================
user_y = 6.5
draw_box(4.5, user_y, 7, BH, "User / Player",
         "play game, observe behavior, provide feedback")

# GameUtils → User (gameplay I/O)
gy = rt_pos[-1]
rightangle([(rcx, gy), (rcx, user_y + BH/2 + 0.15), (11.5, user_y + BH/2)],
           style='<->', lw=1.5)
ax.text(rcx + 0.15, (gy + user_y + BH)/2, 'gameplay\nI/O', fontsize=8, family='serif',
        style='italic', ha='left', va='center', multialignment='center')

# ============================================================
# 7. ITERATIVE REFINEMENT (bottom left)
# ============================================================
FX, FW = 0.5, 5
fy0 = 4.5

fb_data = [
    ("Feedback Analysis", "identify modification targets; scope regeneration"),
    ("Version History", "save / revert versions (localStorage)"),
]

fb_pos = []
for i, (t, d) in enumerate(fb_data):
    y = fy0 - i * (BH + SP)
    draw_box(FX, y, FW, BH, t, d)
    fb_pos.append(y)

draw_group(FX - 0.35, fb_pos[-1] - 0.35, FW + 0.7,
           fy0 + BH - fb_pos[-1] + 0.7, "Iterative Refinement")

# Feedback internal arrow
arr(FX + FW/2, fb_pos[0], FX + FW/2, fb_pos[1] + BH)

# User → Feedback
rightangle([(4.5, user_y + BH/2), (FX + FW + 0.5, user_y + BH/2),
            (FX + FW + 0.5, fb_pos[0] + BH/2), (FX + FW, fb_pos[0] + BH/2)],
           style='->', lw=1.3)
ax.text(3.5, user_y + BH/2 + 0.15, 'feedback', fontsize=8.5, family='serif',
        style='italic', ha='center', va='bottom')

# Version History → Pipeline (dashed loop-back)
rightangle([(FX, fb_pos[1] + BH/2),
            (FX - 1, fb_pos[1] + BH/2),
            (FX - 1, pipe_pos[-1] + BH/2),
            (PX, pipe_pos[-1] + BH/2)],
           style='->', color='black', lw=1.4, ls='--')
ax.text(FX - 1.2, (fb_pos[1] + pipe_pos[-1] + BH) / 2,
        'targeted\nre-generation', fontsize=8, family='serif', style='italic',
        ha='right', va='center', multialignment='center')

# New game: User → Input (light dashed)
rightangle([(5.5, user_y + BH), (5.5, 20.2 + BH/2), (3.5, 20.2 + BH/2)],
           style='->', color='#888888', lw=1.0, ls='--')
ax.text(5.3, (user_y + BH + 20.2)/2 + 0.5, 'new game', fontsize=7.5, family='serif',
        style='italic', ha='right', va='center', color='#888888')

# ============================================================
# Save outputs
# ============================================================
plt.tight_layout(pad=0.5)
plt.savefig('/home/user/gameweb/docs/system_overview.png', dpi=200, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('/home/user/gameweb/docs/system_overview.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')
print("Done: docs/system_overview.png + docs/system_overview.pdf")
