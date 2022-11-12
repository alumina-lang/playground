import React from "react";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Convert from "ansi-to-html";
import styled from "@emotion/styled";
import { Response } from "../src/Response";

export const Output = styled.pre`
  margin: 0;
  padding: 10px;
  font-family: "Source Code Pro", "Courier New", monospace;
  font-weight: normal;
  font-size: 14px;
  font-feature-settings: "liga" 0, "calt" 0;
  line-height: 19px;
  letter-spacing: 0px;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

export function convert(s: string): string {
  if (!s) return "";
  let conv = new Convert({ escapeXML: true });
  return conv.toHtml(Buffer.from(s, "base64").toString("utf-8"));
}

export interface OutputDisplayProps {
  response: Response;
  onHighlight: (line: number, column: number) => void;
}

export const OutputDisplay = ({
  response,
  onHighlight,
}: OutputDisplayProps) => {
  const { success, exit_code, compiler_output, output } = response;

  const dividerStyle = {
    marginTop: "1em",
    textTransform: "uppercase",
    fontWeight: "italic",
    fontSize: "smaller",
  };

  const higlightCodeLocations = (code: string) => {
    const markerRegex = /^(  --&gt; )(program\.alu:([0-9]+):([0-9]+))/gm;

    return code.replaceAll(markerRegex, (match, ...captures) => {
      return `${captures[0]}<a role="button" data-line="${captures[2]}" data-column="${captures[3]}" href="#">${captures[1]}</a>`;
    });
  };

  const higlightPanicBacktrace = (code: string) => {
    const markerRegex =
      /^(--&gt; [a-zA-Z0-9_]+ at )(\/tmp.*program\.alu:([0-9]+))/gm;
    return code.replaceAll(markerRegex, (match, ...captures) => {
      return `${captures[0]}<a role="button" data-line="${captures[2]}" data-column="1" href="#">${captures[1]}</a>`;
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target instanceof HTMLAnchorElement) {
      const line = e.target.dataset.line;
      const column = e.target.dataset.column;
      if (line && column) {
        e.preventDefault();
        onHighlight(parseInt(line), parseInt(column));
      }
    }
  };

  return (
    <>
      {success && exit_code === 0 && <Alert severity="success">Success!</Alert>}
      {success && exit_code !== 0 && (
        <Alert severity="warning">Process exited with code {exit_code}</Alert>
      )}
      {!success && <Alert severity="error">Failed to compile!</Alert>}
      {compiler_output && (
        <>
          <Divider sx={dividerStyle} textAlign="center">
            Compiler output
          </Divider>
          <Output
            onClick={handleClick}
            dangerouslySetInnerHTML={{
              __html: higlightCodeLocations(convert(compiler_output)),
            }}
          />
        </>
      )}
      {output && (
        <>
          <Divider sx={dividerStyle} textAlign="center">
            Program output
          </Divider>
          <Output
            onClick={handleClick}
            dangerouslySetInnerHTML={{
              __html: higlightPanicBacktrace(convert(output)),
            }}
          />
        </>
      )}
    </>
  );
};
