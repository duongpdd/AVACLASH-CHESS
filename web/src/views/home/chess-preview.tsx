import { useTranslations } from "next-intl";
import Icon from "@/components/app-icon";
import { homePreviewBoard } from "./preview-position";

const pieces = { b: "♝︎", k: "♚︎", n: "♞︎", p: "♟︎", q: "♛︎", r: "♜︎" };

export function ChessPreview() {
  const t = useTranslations("home");
  const brand = useTranslations("brand");
  return (
    <figure className="chess-preview">
      <figcaption className="preview-heading">
        <span className="preview-emblem">
          <Icon name="crown" />
        </span>
        <div>
          <strong>{brand("full")}</strong>
          <span>{t("boardCaption")}</span>
        </div>
        <span className="preview-format">5 + 0</span>
      </figcaption>
      <div className="preview-board-frame" aria-hidden="true">
        <div className="preview-ranks">
          {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
            <span key={rank}>{rank}</span>
          ))}
        </div>
        <div className="preview-board">
          {homePreviewBoard.map((piece, index) => {
            const glyph = piece ? pieces[piece.type] : undefined;
            const light = (Math.floor(index / 8) + (index % 8)) % 2 === 0;
            return (
              <span
                key={index}
                className={`preview-square ${light ? "is-light" : "is-dark"}${index === 6 || index === 21 ? " is-last-move" : ""}`}
              >
                {glyph && (
                  <span
                    className={`preview-glyph ${piece?.color === "w" ? "preview-white" : "preview-black"}`}
                  >
                    {glyph}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        <div className="preview-files">
          {"abcdefgh".split("").map((file) => (
            <span key={file}>{file}</span>
          ))}
        </div>
      </div>
      <div className="preview-footer">
        <span>
          <Icon name="clock" />
          {t("blitz")}
        </span>
        <span>
          <Icon name="shield" />
          {t("standardRules")}
        </span>
      </div>
    </figure>
  );
}
