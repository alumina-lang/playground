import { Monaco } from "@monaco-editor/react";

export default function setupMonaco(monaco: Monaco) {
  monaco.languages.register({ id: "alumina" });
  monaco.languages.setLanguageConfiguration("alumina", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: new RegExp("^\\s*#pragma\\s+region\\b"),
        end: new RegExp("^\\s*#pragma\\s+endregion\\b"),
      },
    },
  });

  const keywords = [
    "as",
    "is",
    "protocol",
    "mixin",
    "const",
    "enum",
    "extern",
    "Fn",
    "fn",
    "impl",
    "let",
    "mod",
    "mut",
    "dyn",
    "static",
    "struct",
    "super",
    "type",
    "use",
    "union",
    "macro",
    "self",
    "Self",
    "typeof",
  ];

  monaco.languages.setMonarchTokensProvider("alumina", {
    tokenPostfix: ".alumina",
    defaultToken: "invalid",
    keywords: keywords,

    typeKeywords: [
      "bool",
      "void",
      "u8",
      "u16",
      "u32",
      "u64",
      "u128",
      "usize",
      "i8",
      "i16",
      "i32",
      "i64",
      "i128",
      "isize",
      "f32",
      "f64",
    ],

    controlKeywords: [
      "as",
      "when",
      "break",
      "defer",
      "continue",
      "else",
      "for",
      "if",
      "in",
      "loop",
      "switch",
      "return",
      "yield",
      "while",
    ],

    constants: ["true", "false", "null"],

    supportMacros: [
      "format!",
      "print!",
      "println!",
      "eprint!",
      "eprintln!",
      "unreachable!",
      "dbg!",
      "try!",
      "panic!",
      "assert!",
      "assert_eq!",
      "assert_ne!",
    ],

    operators: [
      "!",
      "!=",
      "%",
      "%=",
      "&",
      "&=",
      "&&",
      "*",
      "*=",
      "+",
      "+=",
      "-",
      "-=",
      "->",
      ".",
      "..",
      "...",
      "/",
      "/=",
      ":",
      ";",
      "<<",
      "<<=",
      "<",
      "<=",
      "=",
      "==",
      "=>",
      ">",
      ">=",
      ">>",
      ">>=",
      "@",
      "^",
      "^=",
      "|",
      "|=",
      "||",
      "_",
      "?",
      "#",
    ],

    escapes: /\\([nrt0\"''\\]|x\h{2}|u\{\h{1,6}\})/,
    delimiters: /[,]/,
    symbols: /[\#\!\%\&\*\+\-\.\/\:\;\<\=\>\@\^\|_\?]+/,
    intSuffixes: /[iu](8|16|32|64|128|size)/,
    floatSuffixes: /f(32|64)/,

    tokenizer: {
      root: [
        [`\\b(${keywords.join("|")})\\b`, "keyword"],
        [/[A-Z_][A-Z_]+\b/, "identifier.constant"],
        [/[A-Z][a-zA-Z0-9_]*\b/, "identifier.type"],
        [/[a-zA-Z_][a-zA-Z0-9_]*\b(?=(::)?[(<])/, "identifier.function"],
        [/[a-zA-Z_][a-zA-Z0-9_]*\b(?=::)/, "identifier.type"],
        [
          /[a-zA-Z_][a-zA-Z0-9_]*\!/,
          {
            cases: {
              "@supportMacros": "keyword",
              "@default": "identifier.function",
            },
          },
        ],
        [
          /[a-zA-Z][a-zA-Z0-9_]*/,
          {
            cases: {
              "@typeKeywords": "keyword.type",
              "@controlKeywords": "keyword.control",
              "@supportMacros": "keyword",
              "@constants": "keyword",
              "@default": "identifier.variable",
            },
          },
        ],
        // Designator
        [/\$/, "identifier"],
        // Byte literal
        [/'(\S|@escapes)'/, "string.byteliteral"],
        // Strings
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        { include: "@numbers" },
        // Whitespace + comments
        { include: "@whitespace" },
        [
          /@delimiters/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "delimiter",
            },
          },
        ],

        [/[{}()\[\]<>]/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
      ],

      comment: [
        [/[^\/*]+/, "comment"],
        [/\/\*/, "comment", "@push"],
        ["\\*/", "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],

      stringraw: [
        [/[^"#]+/, { token: "string" }],
        [
          /"(#*)/,
          {
            cases: {
              "$1==$S2": {
                token: "string.quote",
                bracket: "@close",
                next: "@pop",
              },
              "@default": { token: "string" },
            },
          },
        ],
        [/["#]/, { token: "string" }],
      ],

      numbers: [
        //Octal
        [/(0o[0-7_]+)(@intSuffixes)?/, { token: "number" }],
        //Binary
        [/(0b[0-1_]+)(@intSuffixes)?/, { token: "number" }],
        //Exponent
        [
          /[\d][\d_]*(\.[\d][\d_]*)?[eE][+-][\d_]+(@floatSuffixes)?/,
          { token: "number" },
        ],
        //Float
        [/\b(\d\.?[\d_]*)(@floatSuffixes)?\b/, { token: "number" }],
        //Hexadecimal
        [/(0x[\da-fA-F]+)_?(@intSuffixes)?/, { token: "number" }],
        //Integer
        [/[\d][\d_]*(@intSuffixes?)?/, { token: "number" }],
      ],
    },
  });

  monaco.editor.defineTheme("alumina", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "identifier.function", foreground: "795E26" },
      { token: "identifier.type", foreground: "267f99" },
      { token: "identifier.constant", foreground: "0070C1" },
      { token: "identifier.variable", foreground: "001080" },
      { token: "keyword.type", foreground: "267f99" },
      { token: "keyword.control", foreground: "AF00DB" },
    ],
    colors: {
      //'editor.foreground': '#000000'
    },
  });
}
