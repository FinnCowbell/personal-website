from PIL import Image, ImageDraw

W = (255, 255, 255, 255)
T = (0, 0, 0, 0)

def save_icon(name, pixels):
    img = Image.new("RGBA", (32, 32), T)
    for y, row in enumerate(pixels):
        for x, val in enumerate(row):
            if val:
                img.putpixel((x, y), W)
    img.save(f"{name}.png")
    print(f"Saved {name}.png")

def draw_icon(name, draw_fn):
    img = Image.new("RGBA", (32, 32), T)
    draw = ImageDraw.Draw(img)
    draw_fn(draw)
    img.save(f"{name}.png")
    print(f"Saved {name}.png")

# 1. Mushroom (Fungal Floor) - 3/4 view, elf hat cap
def mushroom(d):
    # Tall pointy cap (elf hat style)
    d.polygon([
        (16, 1),   # tip of cap
        (5, 18),   # left brim
        (27, 18),  # right brim
    ], fill=W)
    # Round out the brim edge
    d.ellipse([4, 15, 28, 21], fill=W)
    # Cap spots (cut out)
    T_color = (0, 0, 0, 0)
    d.ellipse([10, 8, 14, 12], fill=T_color)
    d.ellipse([17, 11, 21, 15], fill=T_color)
    d.ellipse([12, 14, 15, 17], fill=T_color)
    # Short stem below brim
    d.rectangle([12, 21, 20, 27], fill=W)
    # Grass tufts at base
    d.polygon([(8, 29), (10, 23), (12, 29)], fill=W)
    d.polygon([(11, 29), (13, 25), (15, 29)], fill=W)
    d.polygon([(17, 29), (19, 25), (21, 29)], fill=W)
    d.polygon([(20, 29), (22, 23), (24, 29)], fill=W)
    # Ground line
    d.line([(6, 29), (26, 29)], fill=W, width=1)

# 2. Crowd/Heads (Moshed Potation)
def crowd(d):
    # Row of head silhouettes - back row (smaller, higher)
    for x in [4, 10, 16, 22, 27]:
        d.ellipse([x-3, 8, x+3, 14], fill=W)
        d.rectangle([x-2, 14, x+2, 18], fill=W)
    # Front row (larger, lower)
    for x in [2, 8, 15, 22, 29]:
        d.ellipse([x-3, 14, x+4, 22], fill=W)
        d.rectangle([x-2, 22, x+3, 28], fill=W)
    # Raised hands
    d.line([5, 10, 3, 5], fill=W, width=2)
    d.line([12, 10, 14, 4], fill=W, width=2)
    d.line([25, 10, 27, 3], fill=W, width=2)

# 3. Mouse Head Profile (Mouse Army)
def mouse(d):
    # Main head circle
    d.ellipse([6, 10, 24, 28], fill=W)
    # Snout (pointing right)
    d.polygon([(24, 18), (30, 20), (24, 22)], fill=W)
    # Big round ear
    d.ellipse([4, 2, 16, 14], fill=W)
    # Inner ear (cut out)
    T_color = (0, 0, 0, 0)
    d.ellipse([7, 5, 13, 11], fill=T_color)
    # Eye (cut out)
    d.ellipse([17, 15, 21, 19], fill=T_color)
    # Whiskers
    d.line([24, 19, 31, 16], fill=W, width=1)
    d.line([24, 21, 31, 24], fill=W, width=1)

# 4. Deep Hallway (Clawing)
def hallway(d):
    # Outer frame - walls
    d.rectangle([2, 2, 29, 29], fill=W)
    # Cut out inner to make walls
    T_color = (0, 0, 0, 0)
    d.rectangle([4, 4, 27, 27], fill=T_color)
    # Perspective lines converging to center
    cx, cy = 16, 16
    # Left wall
    d.polygon([(2, 2), (10, 10), (10, 22), (2, 29)], fill=W)
    # Right wall
    d.polygon([(29, 2), (22, 10), (22, 22), (29, 29)], fill=W)
    # Top
    d.polygon([(2, 2), (10, 10), (22, 10), (29, 2)], fill=W)
    # Bottom
    d.polygon([(2, 29), (10, 22), (22, 22), (29, 29)], fill=W)
    # Dark center (the vanishing point void)
    d.rectangle([10, 10, 22, 22], fill=T_color)
    # Door frame at end of hall
    d.rectangle([13, 12, 19, 22], outline=W, width=1)

# 5. Elevator Door (Floor 7)
def elevator(d):
    # Outer frame
    d.rectangle([4, 2, 27, 28], outline=W, width=2)
    # Two doors with gap
    d.rectangle([6, 5, 15, 27], outline=W, width=1)
    d.rectangle([16, 5, 25, 27], outline=W, width=1)
    # Center gap line
    d.line([15, 5, 15, 27], fill=W, width=1)
    d.line([16, 5, 16, 27], fill=W, width=1)
    # Up arrow above
    d.polygon([(14, 3), (16, 1), (18, 3)], fill=W)
    # Door handles
    d.point((13, 16), fill=W)
    d.point((18, 16), fill=W)

# 6. Pow/Explosion (Honch)
def pow_explosion(d):
    # Starburst shape
    cx, cy = 16, 16
    points = []
    import math
    for i in range(12):
        angle = math.radians(i * 30 - 90)
        r = 14 if i % 2 == 0 else 7
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        points.append((px, py))
    d.polygon(points, fill=W)
    # Cut out center for "POW" feel
    T_color = (0, 0, 0, 0)
    d.ellipse([11, 11, 21, 21], fill=T_color)
    # Impact dot in center
    d.ellipse([14, 14, 18, 18], fill=W)

# 7. Shadows (Nothing/emptiness)
def shadows(d):
    # Sparse scattered pixels fading out - like dissolving
    import random
    random.seed(42)
    for y in range(32):
        for x in range(32):
            # More dense at bottom, fading to nothing at top
            density = (y / 32) * 0.15
            if random.random() < density:
                d.point((x, y), fill=W)

# 8. Bridge/Gate (Gated)
def gate(d):
    # Two pillars
    d.rectangle([3, 6, 7, 28], fill=W)
    d.rectangle([24, 6, 28, 28], fill=W)
    # Pillar tops
    d.rectangle([2, 4, 8, 7], fill=W)
    d.rectangle([23, 4, 29, 7], fill=W)
    # Suspension cables - main cable curve
    for x in range(7, 25):
        y = int(6 + 8 * ((x - 16) / 9) ** 2)
        d.point((x, y), fill=W)
        if y < 28:
            d.line([(x, y), (x, min(y + 4, 20))], fill=W, width=1)
    # Road deck
    d.rectangle([3, 20, 28, 22], fill=W)
    # Vertical suspender cables
    for x in range(9, 24, 3):
        d.line([(x, 12), (x, 20)], fill=W, width=1)

# 9. Boulder/Mossy Rock
def boulder(d):
    # Irregular rock shape
    d.polygon([
        (10, 8), (14, 5), (20, 4), (25, 7), (28, 12),
        (27, 20), (24, 25), (18, 28), (10, 27), (5, 23),
        (3, 16), (4, 11)
    ], fill=W)
    # Texture cracks (cut out)
    T_color = (0, 0, 0, 0)
    d.line([10, 14, 16, 18], fill=T_color, width=1)
    d.line([16, 18, 14, 23], fill=T_color, width=1)
    d.line([18, 10, 22, 16], fill=T_color, width=1)
    # Moss patches on top (small bumps)
    d.ellipse([9, 6, 13, 10], fill=W)
    d.ellipse([14, 3, 18, 7], fill=W)
    d.ellipse([19, 3, 24, 6], fill=W)

# 10. Waves (Wonk 2A)
def waves(d):
    import math
    # Three rows of waves
    for row, y_base in enumerate([10, 17, 24]):
        offset = row * 4
        for x in range(1, 31):
            y = int(y_base + 3 * math.sin((x + offset) * 0.5))
            d.point((x, y), fill=W)
            d.point((x, y + 1), fill=W)
            if row < 2:
                d.point((x, y + 2), fill=W)


# Generate all
draw_icon("mushroom", mushroom)
draw_icon("crowd", crowd)
draw_icon("mouse", mouse)
draw_icon("hallway", hallway)
draw_icon("elevator", elevator)
draw_icon("pow", pow_explosion)
draw_icon("shadows", shadows)
draw_icon("gate", gate)
draw_icon("boulder", boulder)
draw_icon("waves", waves)

print("\nAll icons generated!")
