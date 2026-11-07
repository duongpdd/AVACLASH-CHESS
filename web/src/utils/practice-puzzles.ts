import { defaultUiText } from "@/i18n/ui-copy";
export type Solution = Record<string, null | { reply: string; next: Solution }>;

export const puzzles: {
  title: string;
  mateIn: number;
  fen: string;
  solution: Solution;
}[] = [
  {
    title: defaultUiText("messageBackRankCheckmate"),
    mateIn: 1,
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: { e1e8: null },
  },
  {
    title: defaultUiText("messageMateInOne2"),
    mateIn: 1,
    fen: "k7/8/1K6/8/8/8/8/4Q3 w - - 0 1",
    solution: { e1e8: null },
  },
  {
    title: defaultUiText("messageMateInOne3"),
    mateIn: 1,
    fen: "k7/8/K7/8/8/8/8/6Q1 w - - 0 1",
    solution: { g1a7: null, g1g8: null },
  },
  {
    title: defaultUiText("messageMateInOne4"),
    mateIn: 1,
    fen: "k7/8/1K6/8/6Q1/8/8/8 w - - 0 1",
    solution: { g4c8: null, g4g8: null },
  },
  {
    title: defaultUiText("messageMateInOne5"),
    mateIn: 1,
    fen: "5k2/8/1Q3K2/8/8/8/8/8 w - - 0 1",
    solution: { b6b8: null, b6d8: null },
  },
  {
    title: defaultUiText("messageMateInTwo1"),
    mateIn: 2,
    fen: "k7/8/8/K7/8/2Q5/8/8 w - - 0 1",
    solution: { a5b6: { reply: "a8b8", next: { c3h8: null } } },
  },
  {
    title: defaultUiText("messageMateInTwo2"),
    mateIn: 2,
    fen: "k7/8/2K5/8/5Q2/8/8/8 w - - 0 1",
    solution: {
      c6c7: { reply: "a8a7", next: { f4a4: null } },
      f4f7: { reply: "a8b8", next: { f7b7: null } },
      f4b4: { reply: "a8a7", next: { b4b7: null } },
    },
  },
  {
    title: defaultUiText("messageMateInTwo3"),
    mateIn: 2,
    fen: "2k5/8/3K4/6Q1/8/8/8/8 w - - 0 1",
    solution: { g5b5: { reply: "c8d8", next: { b5b8: null, b5d7: null } } },
  },
  {
    title: defaultUiText("messageMateInTwo4"),
    mateIn: 2,
    fen: "6k1/8/Q6K/8/8/8/8/8 w - - 0 1",
    solution: { a6f1: { reply: "g8h8", next: { f1f8: null } } },
  },
  {
    title: defaultUiText("messageMateInTwo5"),
    mateIn: 2,
    fen: "6k1/1Q6/8/6K1/8/8/8/8 w - - 0 1",
    solution: {
      g5f6: { reply: "g8h8", next: { b7g7: null } },
      g5g6: {
        reply: "g8h8",
        next: { b7a8: null, b7b8: null, b7c8: null, b7g7: null, b7h7: null },
      },
    },
  },
  {
    title: defaultUiText("messageMateInThree1"),
    mateIn: 3,
    fen: "k7/8/3K4/8/8/8/8/6Q1 w - - 0 1",
    solution: {
      d6c6: {
        reply: "a8b8",
        next: {
          g1b6: { reply: "b8c8", next: { b6c7: null } },
          g1g7: {
            reply: "b8c8",
            next: { g7f8: null, g7g8: null, g7h8: null, g7c7: null },
          },
          g1a1: { reply: "b8c8", next: { a1a8: null, a1h8: null } },
        },
      },
      g1g7: {
        reply: "a8b8",
        next: {
          d6c6: {
            reply: "b8c8",
            next: { g7f8: null, g7g8: null, g7h8: null, g7c7: null },
          },
        },
      },
      g1b1: {
        reply: "a8a7",
        next: {
          d6c7: {
            reply: "a7a8",
            next: { b1a2: null, b1b7: null, b1b8: null, b1a1: null },
          },
          d6c6: { reply: "a7a8", next: { b1b7: null } },
        },
      },
    },
  },
  {
    title: defaultUiText("messageMateInThree2"),
    mateIn: 3,
    fen: "2k5/8/5K2/Q7/8/8/8/8 w - - 0 1",
    solution: {
      a5a7: {
        reply: "c8d8",
        next: { a7b7: { reply: "d8e8", next: { b7c8: null, b7e7: null } } },
      },
    },
  },
  {
    title: defaultUiText("messageMateInThree3"),
    mateIn: 3,
    fen: "1k6/8/3K4/8/7Q/8/8/8 w - - 0 1",
    solution: {
      d6c6: {
        reply: "b8a7",
        next: {
          c6c7: { reply: "a7a8", next: { h4a4: null } },
          h4e7: { reply: "a7a8", next: { e7b7: null } },
          h4d8: { reply: "a7a6", next: { d8b6: null, d8a8: null } },
          h4h8: { reply: "a7a6", next: { h8a1: null, h8a8: null } },
          h4b4: { reply: "a7a8", next: { b4b7: null } },
        },
      },
      h4e7: {
        reply: "b8a8",
        next: {
          d6c7: { reply: "a8a7", next: { e7a3: null } },
          d6c6: { reply: "a8b8", next: { e7b7: null } },
        },
      },
      h4h7: {
        reply: "b8a8",
        next: { d6c6: { reply: "a8b8", next: { h7b7: null } } },
      },
      h4e4: {
        reply: "b8a7",
        next: { d6c7: { reply: "a7a6", next: { e4a4: null } } },
      },
      h4b4: {
        reply: "b8c8",
        next: {
          d6c6: { reply: "c8d8", next: { b4f8: null } },
          b4b5: { reply: "c8d8", next: { b5b8: null, b5d7: null } },
          b4b3: { reply: "c8d8", next: { b3b8: null, b3g8: null } },
          b4b2: { reply: "c8d8", next: { b2b8: null, b2h8: null } },
          b4b1: { reply: "c8d8", next: { b1b8: null } },
        },
      },
    },
  },
  {
    title: defaultUiText("messageMateInThree4"),
    mateIn: 3,
    fen: "5k2/1Q6/8/8/3K4/8/8/8 w - - 0 1",
    solution: {
      d4e5: {
        reply: "f8g8",
        next: { e5f6: { reply: "g8h8", next: { b7g7: null } } },
      },
    },
  },
  {
    title: defaultUiText("messageMateInThree5"),
    mateIn: 3,
    fen: "7k/8/8/5K2/8/8/5Q2/8 w - - 0 1",
    solution: {
      f5f6: {
        reply: "h8h7",
        next: {
          f6f7: { reply: "h7h8", next: { f2h4: null, f2h2: null } },
          f2g3: { reply: "h7h8", next: { g3g7: null } },
          f2g2: { reply: "h7h8", next: { g2g7: null } },
          f2g1: { reply: "h7h8", next: { g1g7: null } },
        },
      },
      f5g6: {
        reply: "h8g8",
        next: {
          g6h6: { reply: "g8h8", next: { f2f8: null } },
          f2d4: { reply: "g8f8", next: { d4d8: null } },
          f2c5: { reply: "g8h8", next: { c5c8: null, c5f8: null } },
          f2b6: { reply: "g8h8", next: { b6b8: null, b6d8: null } },
          f2a7: {
            reply: "g8h8",
            next: { a7a8: null, a7b8: null, a7g7: null, a7h7: null },
          },
          f2f3: { reply: "g8h8", next: { f3a8: null, f3f8: null } },
          f2f4: { reply: "g8h8", next: { f4b8: null, f4f8: null } },
          f2f5: { reply: "g8h8", next: { f5c8: null, f5f8: null } },
          f2f7: {
            reply: "g8h8",
            next: { f7e8: null, f7f8: null, f7g7: null, f7h7: null },
          },
          f2h4: { reply: "g8f8", next: { h4d8: null } },
          f2f1: { reply: "g8h8", next: { f1f8: null } },
          f2d2: { reply: "g8h8", next: { d2d8: null } },
          f2a2: { reply: "g8h8", next: { a2a8: null } },
        },
      },
      f2a7: {
        reply: "h8g8",
        next: {
          f5f6: { reply: "g8h8", next: { a7g7: null } },
          f5g6: {
            reply: "g8h8",
            next: { a7a8: null, a7b8: null, a7g7: null, a7h7: null },
          },
        },
      },
      f2g3: {
        reply: "h8h7",
        next: { f5f6: { reply: "h7h8", next: { g3g7: null } } },
      },
      f2g2: {
        reply: "h8h7",
        next: { f5f6: { reply: "h7h8", next: { g2g7: null } } },
      },
      f2g1: {
        reply: "h8h7",
        next: { f5f6: { reply: "h7h8", next: { g1g7: null } } },
      },
    },
  },
];
