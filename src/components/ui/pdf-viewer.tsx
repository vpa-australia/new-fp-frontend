'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Printer } from "lucide-react";

interface PdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
}

export function PdfViewer({ isOpen, onClose, pdfUrl, title = 'PDF Preview' }: PdfViewerProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.contentWindow?.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 flex flex-row items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
          <Button
            onClick={handlePrint}
            className="flex items-center gap-2 mr-5"
            variant="outline"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogHeader>
        <div className="w-full h-[80vh]">
          <iframe
            ref={iframeRef}
            src={`${pdfUrl}#toolbar=0`}
            className="w-full h-full"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}