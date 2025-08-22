import React, { useState } from "react";
import { CodeModal } from "../components/CodeModal";
import { graphqlRequest } from "../utils/graphqlClient";
import { formatId } from "../utils/formatting";

const QUERIES: Record<string, string> = {
  task: `query GetTaskFile($id: ID!) { task(id: $id) { fileContents } }`,
  resource: `query GetResourceFile($id: ID!) { resource(id: $id) { fileContents } }`,
  middleware: `query GetMiddlewareFile($id: ID!) { middleware(id: $id) { fileContents } }`,
  event: `query GetEventFile($id: ID!) { event(id: $id) { fileContents } }`,
};

export const useFileViewerModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalProps, setModalProps] = useState<{ title: string; subtitle?: string }>({ title: "" });

  const openModal = async (
    kind: "task" | "resource" | "middleware" | "event",
    id: string,
    title?: string | null,
    filePath?: string | null
  ) => {
    const query = QUERIES[kind];
    if (!query) return;

    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    setModalProps({
        title: title || formatId(id),
        subtitle: filePath || undefined,
    });

    try {
      const result = await graphqlRequest<any>(query, { id });
      const content = result?.[kind]?.fileContents ?? "No content available.";
      setFileContent(content);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const ModalComponent = () => (
    <CodeModal
      {...modalProps}
      isOpen={isModalOpen}
      onClose={closeModal}
      code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
    />
  );

  return {
    openModal,
    ModalComponent,
  };
};
