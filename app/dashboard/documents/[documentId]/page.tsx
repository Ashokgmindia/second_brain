"use client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import ChatPanel from "./chat-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDocumentButton } from "./delete-document-button";
import Papa from "papaparse"; // CSV parser
import { useEffect, useState } from "react";

// Component to preview CSV files
function CSVPreview({ csvUrl }: { csvUrl: string }) {
  const [data, setData] = useState<string[][]>([]);

  useEffect(() => {
    fetch(csvUrl)
      .then((response) => response.text())
      .then((csvText) => {
        const parsedData = Papa.parse(csvText).data;
        setData(parsedData as string[][]);
      });
  }, [csvUrl]);

  return (
    <table className="table-auto w-full">
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="border px-2 py-1">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DocumentPage({
  params,
}: {
  params: {
    documentId: Id<"documents">;
  };
}) {
  const document = useQuery(api.documents.getDocument, {
    documentId: params.documentId,
  });

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase();
  };

  return (
    <main className="space-y-8 w-full">
      {!document && (
        <div className="space-y-8">
          <div>
            <Skeleton className="h-[40px] w-[500px]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-[40px] w-[80px]" />
            <Skeleton className="h-[40px] w-[80px]" />
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      )}

      {document && (
        <>
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold">{document.title}</h1>

            <DeleteDocumentButton documentId={document._id} />
          </div>

          <div className="flex gap-12">
            <Tabs defaultValue="document" className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="document">Document</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>

              <TabsContent value="document">
                <div className="bg-gray-450 p-4 rounded-xl flex-1 h-[500px]">
                  {document.documentUrl && (
                    <>
                      {(() => {
                        const fileExtension = getFileExtension(document.title);

                        if (fileExtension === "pdf" || fileExtension === "txt") {
                          // PDF or TXT preview (render directly in iframe)
                          return (
                            <iframe
                              className="w-full h-full"
                              src={document.documentUrl}
                              title={document.title}
                            />
                          );
                        } else if (fileExtension === "csv") {
                          // CSV preview
                          return <CSVPreview csvUrl={document.documentUrl} />;
                        } else if (fileExtension === "docx" || fileExtension === "xlsx") {
                          // Word or Excel preview via Google Docs Viewer
                          return (
                            <iframe
                              className="w-full h-full"
                              src={`https://docs.google.com/viewer?url=${document.documentUrl}&embedded=true`}
                              title={document.title}
                            />
                          );
                        } else {
                          // Fallback to iframe for other file types (attempt to render)
                          return (
                            <iframe
                              className="w-full h-full"
                              src={document.documentUrl}
                              title={document.title}
                            />
                          );
                        }
                      })()}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chat">
                <ChatPanel documentId={document._id} />
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </main>
  );
}
