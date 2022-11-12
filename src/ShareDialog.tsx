import React from "react";
import Button from "@mui/material/Button";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { useSnackbar } from "notistack";

export interface ShareDialogProps {
  open: boolean;
  url: string;
  onClose: () => void;
}
export const ShareDialog = ({ open, url, onClose }: ShareDialogProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      console.error(e);
      // Should never happen really
      enqueueSnackbar("Failed to copy to clipboard", { variant: "error" });
      return;
    } finally {
    }

    onClose();
  };

  return (
    <Dialog fullWidth onClose={onClose} open={open}>
      <DialogTitle>Shared code link</DialogTitle>

      <DialogContent>
        <TextField value={url} fullWidth disabled />
      </DialogContent>

      <DialogActions>
        <Button onClick={copyToClipboard}>Copy to clipboard</Button>
      </DialogActions>
    </Dialog>
  );
};
