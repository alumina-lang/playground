import React from "react";
import Editor from "@monaco-editor/react";
import type monaco from "monaco-editor";
import Button from "@mui/material/Button";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import GitHubIcon from "@mui/icons-material/GitHub";
import HelpIcon from "@mui/icons-material/Help";
import ShareIcon from "@mui/icons-material/Share";
import BugReportIcon from "@mui/icons-material/BugReport";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Grid from "@mui/material/Grid";
import ButtonGroup from "@mui/material/ButtonGroup";
import setupMonaco from "../src/setupMonaco";
import Alert from "@mui/material/Alert";
import AdmZip from "adm-zip";
import { GetStaticProps } from "next";
import { useRouter } from "next/router";
import { useTheme } from "@mui/material/styles";
import { useSnackbar } from "notistack";
import useMediaQuery from "@mui/material/useMediaQuery";
import { basename } from "node:path";
import useFontFaceObserver from "use-font-face-observer";
import { OutputDisplay } from "../src/OutputDisplay";
import { ShareDialog } from "../src/ShareDialog";
import { Response } from "../src/Response";

interface ExampleEntry {
  name: string;
  code: string;
}

interface Props {
  examples: Array<ExampleEntry>;
}

const fallbackInitialExample = "hello_world";

const Home = ({ examples }: Props) => {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [compiling, setCompiling] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<boolean>(false);
  const [response, setResponse] = React.useState<Response | null>(null);
  const [selectedExample, setSelectedExample] = React.useState<string>("");
  const [initialCodeLoading, setInitialCodeLoading] =
    React.useState<boolean>(true);

  const [shareDialogUrl, setShareDialogUrl] = React.useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = React.useState<boolean>(false);

  const editorContainerRef = React.useRef<HTMLDivElement>();
  const outputContainerRef = React.useRef<HTMLDivElement>();

  const initialValueRef = React.useRef<string>("");
  const invalidateCodeState = (value?: string) => {
    if (value) {
      if (initialCodeLoading) {
        return;
      }

      setSelectedExample("");
      window.localStorage.setItem("code", value);
    }

    if (router.query.code || router.query.q) {
      router.replace("/", undefined, { shallow: true });
    }
  };

  const theme = useTheme();
  const bigScreen = useMediaQuery(theme.breakpoints.up("md"));
  const mediumScreen = useMediaQuery(theme.breakpoints.up("sm"));

  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );

  const isFontLoaded = useFontFaceObserver([
    {
      family: `Source Code Pro`,
    },
  ]);

  React.useEffect(() => {
    if (isFontLoaded) {
      // @ts-ignore
      editorRef.current?.remeasureFonts?.();
    }
  }, [isFontLoaded]);

  const loadFallbackCode = () => {
    const code = window.localStorage.getItem("code");
    if (code !== null) {
      initialValueRef.current = code;
    } else {
      setSelectedExample(fallbackInitialExample);
      initialValueRef.current = examples.find(
        (t) => t.name === fallbackInitialExample
      )!.code;
    }
    editorRef.current?.setValue(initialValueRef.current);
  };

  const loadInlineCode = (code: string) => {
    initialValueRef.current = code;
    editorRef.current?.setValue(initialValueRef.current);
  };

  const loadInitialCode = async (id: string) => {
    try {
      let res = await fetch(`/api/code?id=${encodeURIComponent(id)}`, {
        method: "GET",
      });
      if (!res.ok) {
        throw new Error("Failed to load initial code");
      }
      let data = await res.json();

      setResponse(data.result);
      // We do not know which one will happen first, Monaco initializing or the
      // code loading from the server, so we save it to ref and then update the
      // editor if it is ready. If it is not, it will read the value from the ref
      // when it mounts
      initialValueRef.current = data.code;
      editorRef.current?.setValue(data.code);
    } catch (e) {
      enqueueSnackbar("Failed to load shared code snippet", {
        variant: "error",
      });
      loadFallbackCode();
      invalidateCodeState();
    } finally {
      setInitialCodeLoading(false);
    }
  };

  React.useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (router.query.code) {
      loadInitialCode(router.query.code as string);
    } else if (router.query.q) {
      loadInlineCode(router.query.q as string);
      setInitialCodeLoading(false);
      router.replace("/", undefined, { shallow: true });
    } else if (initialCodeLoading) {
      loadFallbackCode();
      setInitialCodeLoading(false);
    }
  }, [router.isReady]);

  const hasOutput = !!response || compiling || error;

  const updateHeight = React.useCallback(() => {
    if (editorContainerRef.current) {
      if (bigScreen || !hasOutput) {
        const top = editorContainerRef.current.getBoundingClientRect()["top"];
        editorContainerRef.current.style.height = `calc(${
          window.innerHeight - top
        }px - 1em)`;
      } else {
        editorContainerRef.current.style.height = "calc(50vh - 2em)";
      }
    }

    if (outputContainerRef.current) {
      if (bigScreen || !hasOutput) {
        const top = outputContainerRef.current.getBoundingClientRect()["top"];
        outputContainerRef.current.style.height = `calc(${
          window.innerHeight - top
        }px - 1em)`;
      } else {
        outputContainerRef.current.style.height = "";
      }
    }
  }, [bigScreen, hasOutput]);

  React.useEffect(() => {
    window.addEventListener("resize", updateHeight);
    updateHeight();
    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, [updateHeight]);

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor) {
    editor.setValue(initialValueRef.current);
    editorRef.current = editor;
  }

  async function onRun(tests: boolean) {
    invalidateCodeState();

    setCompiling(true);
    setError(false);
    try {
      let res = await fetch(`/api/run?test=${tests ? 1 : 0}`, {
        method: "POST",
        body: editorRef.current!.getValue(),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      let data = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse(null);
      setError(true);
    } finally {
      setCompiling(false);
    }
  }

  React.useEffect(() => {
    let handler = (event: KeyboardEvent) => {
      if (event.code == "KeyS" && event.ctrlKey) {
        event.preventDefault();
        if (!initialCodeLoading && !compiling) {
          onRun(false);
        }
        return false;
      }
      return true;
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [initialCodeLoading, compiling, onRun]);

  React.useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.updateOptions({
      folding: mediumScreen,
      lineNumbers: mediumScreen ? "on" : "off",
      lineDecorationsWidth: mediumScreen ? 10 : 2,
      lineNumbersMinChars: mediumScreen ? 5 : 0,
      glyphMargin: false,
    });
  }, [mediumScreen]);

  async function share() {
    setSaving(true);
    try {
      let res = await fetch(`/api/code`, {
        method: "POST",
        body: JSON.stringify({
          code: editorRef.current!.getValue(),
          result: response,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      let data = await res.json();
      router.replace({ pathname: "/", query: { code: data.id } }, undefined, {
        shallow: true,
      });

      setShareDialogUrl(`${window.location.origin}/?code=${data.id}`);
      setShareDialogOpen(true);
    } catch (e) {
      enqueueSnackbar("Failed to share code", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function exampleChange(event: any) {
    editorRef.current!.setValue(
      examples.find((t) => t.name === event.target.value)!.code
    );
    setSelectedExample(event.target.value || "");
    editorRef.current!.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
  }

  return (
    <>
      <ShareDialog
        open={shareDialogOpen}
        url={shareDialogUrl}
        onClose={() => setShareDialogOpen(false)}
      />
      <Container maxWidth="xl">
        <Box
          my={2}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          display="flex"
          gap={1}
        >
          <ButtonGroup
            variant="outlined"
            size={mediumScreen ? "large" : "medium"}
          >
            <Button
              onClick={() => onRun(false)}
              disabled={initialCodeLoading || compiling}
              startIcon={<PlayArrowIcon />}
            >
              Run
            </Button>

            <Button
              onClick={() => onRun(true)}
              disabled={initialCodeLoading || compiling}
              startIcon={<BugReportIcon />}
            >
              Test
            </Button>

            <Button
              onClick={share}
              disabled={initialCodeLoading || saving || compiling}
              startIcon={<ShareIcon />}
            >
              Share code
            </Button>
          </ButtonGroup>

          <FormControl size="small" sx={{ minWidth: "7em" }}>
            <InputLabel id="example-label">Examples</InputLabel>
            <Select
              variant="outlined"
              labelId="example-label"
              autoWidth={true}
              value={selectedExample}
              size="small"
              onChange={exampleChange}
              label="Examples"
            >
              {examples.map((example) => (
                <MenuItem key={example.name} value={example.name}>
                  {example.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {bigScreen && <div style={{ display: "flex", flexGrow: 1 }} />}
          <Button
            color="primary"
            href="https://github.com/alumina-lang/alumina"
            target="_blank"
            variant="text"
            size="medium"
            startIcon={<GitHubIcon />}
          >
            GitHub
          </Button>
          <Button
            color="primary"
            href="https://docs.alumina-lang.net/"
            target="_blank"
            variant="text"
            size="medium"
            startIcon={<HelpIcon />}
          >
            Docs
          </Button>
        </Box>
        <Grid container justifyContent="space-between" spacing={2}>
          <Grid item md={hasOutput ? 7 : 12} xs={12}>
            <Box
              border="1px solid #d3d3d3"
              flexDirection="column"
              sx={{ overflow: "hidden" }}
              ref={editorContainerRef}
            >
              <Editor
                defaultLanguage="alumina"
                theme="alumina"
                onMount={handleEditorDidMount}
                onChange={invalidateCodeState}
                beforeMount={setupMonaco}
                options={{
                  automaticLayout: true,
                  folding: mediumScreen,
                  lineNumbers: mediumScreen ? "on" : "off",
                  lineDecorationsWidth: mediumScreen ? 10 : 2,
                  lineNumbersMinChars: mediumScreen ? 5 : 0,
                  glyphMargin: false,
                  fontFamily: '"Source Code Pro", "Courier New", monospace',
                  fontSize: 15,
                  fontLigatures: true,
                  minimap: {
                    enabled: false,
                  },
                }}
              />
            </Box>
          </Grid>
          {hasOutput && (
            <Grid item md={5} xs={12}>
              <Box ref={outputContainerRef} sx={{ overflowY: "auto" }}>
                {compiling && (
                  <Box my={2} display="flex" justifyContent="center">
                    <CircularProgress />
                  </Box>
                )}
                {response && !compiling && (
                  <OutputDisplay
                    response={response}
                    onHighlight={(lineNumber: number, column: number) => {
                      editorRef.current!.focus();
                      editorRef.current!.setPosition({ lineNumber, column });
                      editorRef.current!.revealPositionInCenter({
                        lineNumber,
                        column,
                      });
                    }}
                  />
                )}
                {error && !compiling && (
                  <Alert severity="error">Failed to fetch!</Alert>
                )}
              </Box>
            </Grid>
          )}
        </Grid>
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps = async (context) => {
  const res = await fetch(
    process.env.EXAMPLES_REV
      ? `https://codeload.github.com/alumina-lang/alumina/zip/${process.env.EXAMPLES_REV}`
      : `https://codeload.github.com/alumina-lang/alumina/zip/refs/heads/master`
  );

  const body = await res.blob();
  const zip = new AdmZip(Buffer.from(await body.arrayBuffer()));
  const zipEntries = zip.getEntries();

  const examples: Array<ExampleEntry> = zipEntries
    .filter(
      (e) => e.entryName.includes("/examples/") && e.entryName.endsWith(".alu")
    )
    .map((e) => ({
      name: basename(e.entryName).replace(/\.alu$/, ""),
      code: e.getData().toString("utf8"),
    }));

  if (!examples.find((e) => e.name === fallbackInitialExample)) {
    throw new Error("Failed to find fallback example");
  }

  // By returning { props: { posts } }, the Blog component
  // will receive `posts` as a prop at build time
  return {
    props: {
      examples,
    },
  };
};

export default Home;
