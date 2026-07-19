import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableItem({ id, children, disabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/sortable h-full w-full"
    >
      <div
        {...attributes}
        {...listeners}
        className={`absolute left-2 top-2 p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 z-[100] transition-colors bg-white/90 dark:bg-slate-800/90 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 backdrop-blur-sm touch-none ${disabled ? "hidden" : ""}`}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </div>
  );
}
