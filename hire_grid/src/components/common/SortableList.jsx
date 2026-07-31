import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "./SortableItem";
import { api } from "../../lib/api";


export function SortableList({
  items,
  collectionName,
  onOrderChange,
  onSaveOrder,
  renderItem,
  grid = false,
  disabled = false,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);

      // Calculate new display orders (100, 200, 300...)
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        displayOrder: (index + 1) * 100,
      }));

      if (onOrderChange) {
        onOrderChange(updatedItems);
      }

      // Save to PostgreSQL database via API
      try {
        if (onSaveOrder) {
          await onSaveOrder(updatedItems);
        } else if (collectionName === "modules") {
          await api.post("/modules", { modules: updatedItems });
        } else if (collectionName === "companies") {
          for (const comp of updatedItems) {
            await api.post("/companies", comp);
          }
        } else if (collectionName === "hierarchy_nodes" || collectionName === "hierarchy-nodes") {
          for (const node of updatedItems) {
            await api.post("/hierarchy-nodes", node);
          }
        }
      } catch (error) {
        console.error("Failed to save new order:", error);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id} disabled={disabled}>
            {renderItem(item)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
