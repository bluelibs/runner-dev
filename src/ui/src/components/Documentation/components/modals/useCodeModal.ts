import { useCallback, useState } from "react";
import { FileDiff, FileReference } from "../../components/ChatTypes";

export type CodeModalState =
  | { isOpen: false; kind: "none" }
  | {
      isOpen: true;
      kind: "file";
      title: string;
      subtitle?: string;
      file: FileReference;
    }
  | {
      isOpen: true;
      kind: "diff";
      title: string;
      subtitle?: string;
      diff: FileDiff;
    };

export function useCodeModal() {
  const [state, setState] = useState<CodeModalState>({
    isOpen: false,
    kind: "none",
  });

  const openFile = useCallback(
    (file: FileReference, title?: string, subtitle?: string) => {
      setState({
        isOpen: true,
        kind: "file",
        title: title || `File: ${file.fileName}`,
        subtitle,
        file,
      });
    },
    []
  );

  const openDiff = useCallback(
    (diff: FileDiff, title?: string, subtitle?: string) => {
      setState({
        isOpen: true,
        kind: "diff",
        title: title || `Diff: ${diff.fileName}`,
        subtitle,
        diff,
      });
    },
    []
  );

  const close = useCallback(
    () => setState({ isOpen: false, kind: "none" }),
    []
  );

  return { state, openFile, openDiff, close };
}
