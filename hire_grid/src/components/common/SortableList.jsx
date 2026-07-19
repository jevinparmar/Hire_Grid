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
import { db, doc, writeBatch } from "../../firebase";


export function SortableList({
  items,
  collectionName,
  onOrderChange,
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

      // Save to Firestore using a batch
      try {
        const batch = writeBatch(db);
        updatedItems.forEach((item) => {
          const docRef = doc(db, collectionName, item.id);
          batch.update(docRef, { displayOrder: item.displayOrder });
        });
        await batch.commit();
      } catch (error) {
        console.error("Failed to save new order:", error);
        alert("Failed to save display order.");
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
