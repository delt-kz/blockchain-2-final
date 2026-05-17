from pathlib import Path
from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "presentation"
PDF_PATH = OUT_DIR / "final-presentation.pdf"
PREVIEW_DIR = OUT_DIR / "preview"

W, H = 1280, 720
PDF_SIZE = landscape((W, H))


slides = [
    {
        "title": "DeFi Student Protocol",
        "kicker": "Blockchain Technologies 2 Final Project",
        "bullets": [
            "A Base Sepolia DeFi Super-App with AMM, ERC4626 vault, DAO governance, oracle checks, frontend, and subgraph.",
            "Built to demonstrate the full course stack in one auditable repository.",
        ],
        "accent": "#25C2A0",
    },
    {
        "title": "What We Built",
        "kicker": "Scope",
        "bullets": [
            "Upgradeable UUPS treasury controlled by Timelock.",
            "Factory with CREATE and CREATE2 AMM pair deployment.",
            "Constant-product AMM with LP token, 0.3% fee, and slippage protection.",
            "ERC20Votes + Permit, ERC4626 vault, ERC1155 items, Chainlink-compatible oracle.",
        ],
        "accent": "#5B8DEF",
    },
    {
        "title": "Architecture",
        "kicker": "Main components",
        "bullets": [
            "React dApp talks to Base Sepolia through wagmi and viem.",
            "Subgraph indexes token, governance, AMM, vault, and item events.",
            "Governor schedules privileged calls through a 2 day Timelock.",
            "Timelock owns treasury roles, token owner, vault owner, factory, AMM pair, and oracle.",
        ],
        "accent": "#F2C94C",
    },
    {
        "title": "Smart Contracts",
        "kicker": "Required standards",
        "bullets": [
            "GovernanceToken: ERC20Votes + ERC20Permit.",
            "YieldVault: ERC4626 deposit, mint, withdraw, redeem flows.",
            "ProtocolItems: ERC1155 with AccessControl and Pausable.",
            "AssemblyMath: Yul implementation benchmarked against Solidity.",
        ],
        "accent": "#EB5757",
    },
    {
        "title": "AMM Design",
        "kicker": "DeFi primitive",
        "bullets": [
            "DefiSwapPair implements x*y=k from scratch.",
            "Swap input fee is 0.3%; a protocol fee share is sent to treasury.",
            "minAmountOut protects against slippage.",
            "Foundry invariant checks constant product behavior.",
        ],
        "accent": "#9B51E0",
    },
    {
        "title": "Governance Flow",
        "kicker": "DAO controls privileged actions",
        "bullets": [
            "Voting delay: 1 day.",
            "Voting period: 1 week.",
            "Quorum: 4%. Proposal threshold: 1%.",
            "Lifecycle demonstrated: propose -> vote -> queue -> execute.",
        ],
        "accent": "#2D9CDB",
    },
    {
        "title": "Security Posture",
        "kicker": "Controls",
        "bullets": [
            "Privileged functions use Ownable or AccessControl.",
            "Token and ETH movement uses SafeERC20, checked call, and ReentrancyGuard.",
            "No tx.origin authorization. No transfer/send for ETH.",
            "Vulnerability case studies reproduce and fix reentrancy and access-control bugs.",
        ],
        "accent": "#27AE60",
    },
    {
        "title": "Oracle + Indexing",
        "kicker": "Lecture 8",
        "bullets": [
            "Chainlink-compatible price adapter rejects stale, zero, negative, and incomplete rounds.",
            "MockV3Aggregator gives deterministic tests and demo deployment.",
            "Subgraph has more than 4 entities and documented GraphQL queries.",
            "Frontend has a dedicated subgraph data view.",
        ],
        "accent": "#F2994A",
    },
    {
        "title": "Frontend",
        "kicker": "User experience",
        "bullets": [
            "Wallet connection through MetaMask injected connector.",
            "Reads balance, voting power, delegate address, AMM reserves, and vault state.",
            "Write actions: delegate, approve/deposit, cast vote.",
            "Readable errors for rejected transactions, wrong network, insufficient balance, and RPC issues.",
        ],
        "accent": "#56CCF2",
    },
    {
        "title": "Deployment",
        "kicker": "Base Sepolia",
        "bullets": [
            "All contracts deployed and verified on Base Sepolia.",
            "Post-deployment script verifies Timelock ownership, Governor settings, and treasury roles.",
            "Deployment addresses and BaseScan links are committed.",
            "Demo proposal is created and configured for the UI.",
        ],
        "accent": "#BB6BD9",
    },
    {
        "title": "Testing + CI",
        "kicker": "Automation",
        "bullets": [
            "Hardhat tests pass locally.",
            "Foundry suite contains 80+ unit tests, 10 fuzz tests, 5 invariants, and 3 fork tests.",
            "CI runs compile, typecheck, Solidity lint, frontend Prettier, frontend build, subgraph build, tests, coverage, and Slither.",
            "Coverage gate is documented at 90%+ lines for contracts.",
        ],
        "accent": "#25C2A0",
    },
    {
        "title": "Defense Points",
        "kicker": "What each member should know",
        "bullets": [
            "Why Timelock is the final admin.",
            "How CREATE2 pair prediction works.",
            "Why ERC4626 rounding is delegated to OpenZeppelin and tested.",
            "How stale Chainlink rounds are rejected.",
            "What remains testnet-only: mock assets, mock feeds, centralized demo voting power.",
        ],
        "accent": "#5B8DEF",
    },
]


def hex_color(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def pil_font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    words = text.split()
    lines = []
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_slide_pil(slide, index):
    bg = (12, 18, 28)
    accent = hex_color(slide["accent"])
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)
    title_font = pil_font(62, True)
    kicker_font = pil_font(22, True)
    body_font = pil_font(30, False)
    small_font = pil_font(18, False)

    draw.rectangle([0, 0, 34, H], fill=accent)
    draw.rectangle([88, 88, 1180, 91], fill=accent)
    draw.text((92, 48), slide["kicker"].upper(), font=kicker_font, fill=accent)
    draw.text((92, 118), slide["title"], font=title_font, fill=(245, 248, 255))

    y = 250
    for bullet in slide["bullets"]:
        draw.ellipse([96, y + 11, 112, y + 27], fill=accent)
        for line in wrap(draw, bullet, body_font, 980):
            draw.text((132, y), line, font=body_font, fill=(226, 233, 244))
            y += 40
        y += 18

    draw.text((92, 662), f"{index:02d} / {len(slides):02d}", font=small_font, fill=(120, 132, 150))
    return img


def draw_slide_pdf(c, slide, index):
    accent = colors.HexColor(slide["accent"])
    c.setFillColor(colors.HexColor("#0C121C"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(accent)
    c.rect(0, 0, 34, H, fill=1, stroke=0)
    c.rect(88, H - 91, 1092, 3, fill=1, stroke=0)

    c.setFillColor(accent)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(92, H - 70, slide["kicker"].upper())
    c.setFillColor(colors.HexColor("#F5F8FF"))
    c.setFont("Helvetica-Bold", 62)
    c.drawString(92, H - 178, slide["title"])

    y = H - 280
    c.setFont("Helvetica", 30)
    for bullet in slide["bullets"]:
        c.setFillColor(accent)
        c.circle(104, y + 9, 8, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#E2E9F4"))
        # ReportLab does not expose simple width-based wrapping on canvas, so use conservative character wraps.
        words = bullet.split()
        line = ""
        lines = []
        for word in words:
            trial = f"{line} {word}".strip()
            if c.stringWidth(trial, "Helvetica", 30) <= 980:
                line = trial
            else:
                lines.append(line)
                line = word
        if line:
            lines.append(line)
        for line in lines:
            c.drawString(132, y, line)
            y -= 40
        y -= 18

    c.setFillColor(colors.HexColor("#788496"))
    c.setFont("Helvetica", 18)
    c.drawString(92, 45, f"{index:02d} / {len(slides):02d}")
    c.showPage()


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    pdf = canvas.Canvas(str(PDF_PATH), pagesize=PDF_SIZE)
    for index, slide in enumerate(slides, start=1):
        draw_slide_pdf(pdf, slide, index)
        img = draw_slide_pil(slide, index)
        img.save(PREVIEW_DIR / f"slide-{index:02d}.png")
    pdf.save()

    thumbs = []
    for index in range(1, len(slides) + 1):
        thumb = Image.open(PREVIEW_DIR / f"slide-{index:02d}.png").resize((320, 180))
        thumbs.append(thumb)
    montage = Image.new("RGB", (320 * 3, 180 * 4), (255, 255, 255))
    for index, thumb in enumerate(thumbs):
        x = (index % 3) * 320
        y = (index // 3) * 180
        montage.paste(thumb, (x, y))
    montage.save(OUT_DIR / "preview-montage.png")
    print(PDF_PATH)
    print(PREVIEW_DIR)


if __name__ == "__main__":
    main()
