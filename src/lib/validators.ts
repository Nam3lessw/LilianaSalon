import { z } from "zod";

export const OrderItemSchema = z.object({
  productId: z.string().min(1, "ID de producto requerido").max(100),
  quantity: z.number().int("La cantidad debe ser un entero").min(1, "Mínimo 1 unidad").max(50, "Máximo 50 unidades por ítem"),
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "El pedido debe contener al menos un producto").max(50, "Máximo 50 ítems por pedido"),
  country: z.enum(["GT", "SV"], { message: "País no válido (GT o SV)" }),
  applyWelcomeCoupon: z.boolean().optional().default(false),
  applyPointsDiscount: z.boolean().optional().default(false),
  customerName: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Nombre demasiado largo"),
  customerPhone: z.string().trim().max(30).optional().default(""),
  customerEmail: z.string().trim().email("Formato de correo no válido").optional().or(z.literal("")),
  deliveryNotes: z.string().trim().max(500, "Notas demasiado largas").optional().default(""),
});

export const ProductSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(150),
  brand: z.string().trim().min(1, "Marca requerida").max(100),
  category: z.string().trim().min(1, "Categoría requerida").max(100),
  categories: z.array(z.string().trim().max(100)).optional().default([]),
  price: z.number().positive("El precio debe ser un número positivo").max(100000),
  priceUSD: z.number().positive().max(100000).nullable().optional(),
  oldPrice: z.number().positive().max(100000).nullable().optional(),
  oldPriceUSD: z.number().positive().max(100000).nullable().optional(),
  stock: z.number().int("El inventario debe ser entero").min(0, "El inventario no puede ser negativo").max(100000),
  tag: z.string().trim().max(50).optional().default(""),
  image: z.string().trim().min(1, "Imagen requerida"),
  volume: z.string().trim().max(50).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
});

export const CompleteOrderSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const UpdateCustomerPointsSchema = z.object({
  points: z.number().int("Puntos deben ser número entero").min(0, "Puntos no pueden ser negativos").max(1000000),
});

export const UpdateCustomerCouponSchema = z.object({
  firstPurchaseUsed: z.boolean(),
});
