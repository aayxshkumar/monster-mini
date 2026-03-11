"use client";

import { useState } from "react";
import { useBoothStore } from "@/store/booth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Check, Loader2, AlertCircle, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export function PrintQueuePanel() {
  const printQueue = useBoothStore((s) => s.printQueue);
  const clearDoneJobs = useBoothStore((s) => s.clearDoneJobs);
  const removePrintJob = useBoothStore((s) => s.removePrintJob);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (printQueue.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 py-2">
        <div className="flex items-center gap-3">
          <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">Queue</span>

          <div className="flex flex-1 gap-2 overflow-x-auto">
            {printQueue.map((job) => (
              <div key={job.id} className="group relative flex items-center">
                <Badge
                  variant={
                    job.status === "done" ? "default"
                    : job.status === "error" ? "destructive"
                    : "outline"
                  }
                  className={`gap-1 whitespace-nowrap text-xs font-normal pr-5 cursor-pointer ${
                    job.status === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""
                  }`}
                  title={job.message || job.status}
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  {job.status === "printing" && <Loader2 className="h-3 w-3 animate-spin" />}
                  {job.status === "done" && <Check className="h-3 w-3" />}
                  {job.status === "error" && <AlertCircle className="h-3 w-3" />}
                  {job.status === "pending" && <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />}
                  {job.status}
                  {job.message && (
                    expandedJob === job.id
                      ? <ChevronUp className="h-2.5 w-2.5 ml-0.5" />
                      : <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                  )}
                </Badge>
                <button
                  onClick={() => removePrintJob(job.id)}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20"
                  title="Remove job"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {printQueue.some((j) => j.status === "done") && (
              <Button variant="ghost" size="sm" onClick={clearDoneJobs} className="h-7 text-xs">
                <Check className="mr-1 h-3 w-3" /> Clear done
              </Button>
            )}
            {printQueue.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  printQueue.forEach((j) => {
                    if (j.status !== "printing") removePrintJob(j.id);
                  });
                }}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Expanded error log */}
        {expandedJob && (() => {
          const job = printQueue.find((j) => j.id === expandedJob);
          if (!job || !job.message) return null;
          return (
            <div className="mt-2 rounded border bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-foreground text-xs">Job: {job.id}</span>
                <span className={`text-[10px] font-medium ${job.status === "error" ? "text-red-500" : job.status === "done" ? "text-green-600" : ""}`}>
                  {job.status.toUpperCase()}
                </span>
              </div>
              {job.message}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
