import { createTheme } from "@mui/material/styles";
import { red } from "@mui/material/colors";

// Create a theme instance.
const theme = createTheme({
  typography: {
    fontFamily: ["Fira Sans"].join(","),
  },
  palette: {
    primary: {
      main: "#356da4",
    },
    secondary: {
      main: "#555",
    },
    error: {
      main: red.A400,
    },
  },
});

export default theme;
