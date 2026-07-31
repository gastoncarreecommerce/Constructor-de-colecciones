import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SellerTaggedProduct } from "../lib/types";

interface ReorderListProps {
  products: SellerTaggedProduct[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (skuId: string) => void;
}

interface RowProps {
  product: SellerTaggedProduct;
  position: number;
  onRemove: (skuId: string) => void;
}

function SortableRow({ product, position, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.skuId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 last:border-b-0"
    >
      <button
        type="button"
        aria-label="Arrastrar para reordenar"
        className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-400">
        {position}
      </span>
      {product.imageUrl && (
        <img src={product.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-800">{product.productName}</p>
        <p className="truncate text-xs text-slate-400">
          {product.sellerName} · EAN {product.ean} · SKU {product.skuId}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(product.skuId)}
        className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        Quitar
      </button>
    </li>
  );
}

export default function ReorderList({ products, onReorder, onRemove }: ReorderListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = products.map((p) => p.skuId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">
        Orden final de la colección ({products.length})
      </h2>
      <p className="text-xs text-slate-500">
        Arrastrá para reordenar manualmente. El orden acá abajo es el que se exporta al CSV.
      </p>

      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Todavía no hay productos seleccionados.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={products.map((p) => p.skuId)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="max-h-[36rem] overflow-y-auto rounded-md border border-slate-100">
              {products.map((product, index) => (
                <SortableRow
                  key={product.skuId}
                  product={product}
                  position={index + 1}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
