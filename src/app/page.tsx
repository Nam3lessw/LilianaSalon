"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "./admin/page";
import { MessageCircle, X, Sparkles, Check, Package, Eye, ArrowRight, ShieldCheck, Gift, MapPin, Coins, ShoppingBag, Plus, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCountry } from "@/context/CountryContext";
import { useCart } from "@/context/CartContext";

export default function Home() {
  const { user, userProfile, isAdmin, openAuthModal, setCustomerDrawerOpen } = useAuth();
  const { country, currency, currencySymbol, countryName, countryFlag, formatPrice, getRawPrice } = useCountry();
  const { addToCart, setIsCartOpen, totalItems, total } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);

  const phoneNumber = "50242083721";

  // Controlar clase modal-open en body para ocultar botones flotantes
  useEffect(() => {
    if (selectedProduct) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [selectedProduct]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        if (db) {
          const querySnapshot = await getDocs(collection(db, "products"));
          const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          if (data.length > 0) {
            setProducts(data);
          } else {
            setProducts(defaultProducts);
          }
        } else {
          const local = localStorage.getItem("mockProducts");
          if (local && JSON.parse(local).length > 0) {
            setProducts(JSON.parse(local));
          } else {
            setProducts(defaultProducts);
          }
        }
      } catch (e) {
        console.error("Error fetching products", e);
        setProducts(defaultProducts);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const defaultProducts: Product[] = [
    {
      id: "1",
      name: "Kera Touch Shampoo Keratina",
      brand: "Keratech",
      category: "Keratech",
      price: 180.00,
      priceUSD: 23.25,
      oldPrice: 200.00,
      oldPriceUSD: 25.80,
      tag: "Nuevo",
      volume: "500ml",
      description: "Shampoo profesional enriquecido con keratina pura. Limpia suavemente mientras repara la fibra capilar, elimina el frizz y prolonga la duración de cualquier tratamiento o alisado.",
      image: "https://imgs.search.brave.com/zcDv4i81hfdVy_mP5hOXvMe123QcTKpj",
      stock: 10
    },
    {
      id: "2",
      name: "Ivoga Alisado Orgánico Cero Formol",
      brand: "IvoGa",
      category: "IvoGa",
      price: 450.00,
      priceUSD: 58.00,
      oldPrice: 500.00,
      oldPriceUSD: 64.50,
      tag: "Top Venta",
      volume: "1000ml",
      description: "Tratamiento de alisado 100% orgánico sin formol ni químicos agresivos. Formulado con extractos botánicos de shikakai, jengibre y ortiga para un cabello lacio espejo, suave y con movimiento natural.",
      image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600&auto=format&fit=crop",
      stock: 6
    },
    {
      id: "3",
      name: "Ivoga Mascarilla Hydra-Booster",
      brand: "IvoGa",
      category: "IvoGa",
      price: 180.00,
      priceUSD: 23.25,
      oldPrice: null,
      oldPriceUSD: null,
      tag: "Oferta",
      volume: "250ml",
      description: "Mascarilla de nutrición intensiva para cabellos resecos, decolorados o procesados químicamente. Devuelve la elasticidad y suavidad desde la primera aplicación.",
      image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600&auto=format&fit=crop",
      stock: 8
    },
    {
      id: "4",
      name: "Keratech Repair & Shine Elixir Gotas",
      brand: "Keratech",
      category: "Keratech",
      price: 150.00,
      priceUSD: 19.50,
      oldPrice: 190.00,
      oldPriceUSD: 24.50,
      tag: "Oferta",
      volume: "60ml",
      description: "Gotas de seda restauradoras con aceites de argán y macadamia. Sella puntas abiertas, aporta brillo instantáneo de espejo y termo-protege contra la plancha y secadora.",
      image: "https://images.unsplash.com/photo-1617897903246-719242758050?q=80&w=600&auto=format&fit=crop",
      stock: 2
    }
  ];

  const categoriesList = ["TODOS", "Keratech", "IvoGa", "Cuidado Facial", "Accesorios", "Perfumes"];

  const filteredProducts = selectedCategory === "TODOS"
    ? products
    : products.filter(p => (p.brand || p.category)?.toLowerCase() === selectedCategory.toLowerCase());

  const getWhatsAppProductLink = (product: Product) => {
    const volumeText = product.volume ? ` (${product.volume})` : "";
    const rawPrice = getRawPrice(product.price, product.priceUSD);
    const formattedPrice = formatPrice(product.price, product.priceUSD);
    const destinationCountry = countryName;
    let text = "";

    if (userProfile && !userProfile.firstPurchaseUsed) {
      const discountPrice = (rawPrice * 0.85).toFixed(2);
      const discountFormatted = country === "SV" ? `$${discountPrice} USD` : `Q${discountPrice}`;
      text = `¡Hola Liliana Salon!\nSoy ${userProfile.name} desde ${destinationCountry}.\nMe interesa comprar: ${product.name}${volumeText}.\nCupón 15% (BIENVENIDA15), precio: ${discountFormatted}.\n¿Tienen disponibilidad para envío? Muchas gracias.`;
    } else if (userProfile) {
      text = `¡Hola Liliana Salon!\nSoy ${userProfile.name} desde ${destinationCountry}.\nMe interesa ordenar: ${product.name}${volumeText} por ${formattedPrice}.\n¿Tienen disponibilidad para envío? Muchas gracias.`;
    } else {
      text = `¡Hola Liliana Salon!\nMe interesa adquirir desde ${destinationCountry}: ${product.name}${volumeText} por ${formattedPrice}.\n¿Tienen disponibilidad y servicio de entrega? Muchas gracias.`;
    }

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex flex-col gap-14 sm:gap-24 pb-20 text-gray-900">
      {/* Hero Section Móvil & Desktop */}
      <section className="relative w-full min-h-[480px] sm:h-[75vh] sm:min-h-[550px] bg-[#FAF3EC] flex items-center overflow-hidden py-12 sm:py-0">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=2000&auto=format&fit=crop" 
            alt="Liliana Salon Cuidado Profesional" 
            className="w-full h-full object-cover opacity-45 sm:opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#FAF3EC] via-[#FAF3EC]/85 to-transparent"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex justify-between items-center relative z-10">
          <div className="max-w-xl">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-semibold text-[#B87D5E] mb-2 sm:mb-3 block">
              Distribuidor Oficial • {countryName} {countryFlag}
            </span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif text-gray-900 leading-[1.1] mb-4 sm:mb-6 tracking-tight">
              REVIVE<br />TU CABELLO
            </h1>
            <p className="text-sm sm:text-base text-stone-700 mb-6 sm:mb-8 max-w-md leading-relaxed font-light">
              Especialistas en tratamientos capilares profesionales. Encuentra las líneas oficiales de <strong className="font-semibold text-black">Keratech</strong> y <strong className="font-semibold text-black">IvoGa</strong> para un alisado orgánico, brillo de espejo y reparación profunda.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              <a 
                href="#catalogo" 
                className="bg-black text-white px-7 py-3.5 text-xs tracking-[0.2em] font-semibold uppercase text-center hover:bg-stone-800 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 rounded-lg sm:rounded-none shadow-sm"
              >
                VER PRODUCTOS
              </a>
              <a 
                href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(`Hola Liliana, te escribo desde ${countryName}. Me gustaría recibir asesoría sobre productos para mi cabello.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/90 sm:bg-transparent border border-stone-800 text-stone-900 px-5 py-3.5 text-xs tracking-[0.2em] font-semibold uppercase hover:bg-stone-900 hover:text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 rounded-lg sm:rounded-none shadow-xs"
              >
                <MessageCircle size={15} className="text-[#25D366]" /> ASESORÍA WHATSAPP
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Barra Publicitaria Persuasiva: 15% OFF Primera Compra (Solo clientes, no admin) */}
      {!isAdmin && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full -mt-6 sm:-mt-10 mb-2">
          <div className="bg-gradient-to-r from-[#F9EFE7] via-[#F4E3D5] to-[#EEDCCE] rounded-2xl sm:rounded-3xl border border-[#E6D0BE] overflow-hidden shadow-[0_8px_30px_rgba(192,130,97,0.08)] relative">
            <div className="grid grid-cols-1 md:grid-cols-12 items-center">
              {/* Contenido / Textos Persuasivos */}
              <div className="p-5 sm:p-8 md:p-10 md:col-span-7 flex flex-col justify-center text-left z-10">
                <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-bold text-[#A8623D] mb-1.5 sm:mb-2 block">
                  {userProfile?.firstPurchaseUsed 
                    ? "Beneficio VIP Exclusivo" 
                    : "¿COMPRAS POR PRIMERA VEZ?"}
                </span>

                <h3 className="text-2xl sm:text-3xl md:text-4xl font-serif text-gray-900 leading-[1.15] mb-2 sm:mb-3 font-normal">
                  {userProfile?.firstPurchaseUsed ? (
                    <>ACUMULA PUNTOS<br /><span className="font-bold text-[#A8623D]">EN CADA COMPRA</span></>
                  ) : user ? (
                    <>TU 15% DE DESCUENTO<br /><span className="font-bold text-[#A8623D]">ESTÁ DISPONIBLE</span></>
                  ) : (
                    <>-15% EN TU<br /><span className="font-bold text-[#A8623D]">PRIMERA COMPRA</span></>
                  )}
                </h3>

                <p className="text-xs sm:text-sm text-stone-700 mb-4 sm:mb-5 max-w-md leading-relaxed font-light">
                  {userProfile?.firstPurchaseUsed ? (
                    "Como cliente consentida de Liliana Salon, cada compra te otorga puntos canjeables por productos y descuentos en tu próximo pedido."
                  ) : user ? (
                    `Tu cupón BIENVENIDA15 está autorizado para tu correo (${user.email}). Aplícalo en 1 solo producto al ordenar por WhatsApp.`
                  ) : (
                    "Crea tu cuenta gratis hoy para recibir un cupón exclusivo del 15% OFF en tu primer producto. Válido una sola vez al ordenar."
                  )}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3">
                  {userProfile?.firstPurchaseUsed ? (
                    <button
                      onClick={() => setCustomerDrawerOpen(true)}
                      className="bg-[#B85728] hover:bg-[#9E461D] text-white px-6 py-3 text-xs tracking-[0.2em] font-bold uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-xl shadow-md flex items-center gap-2"
                    >
                      <Coins size={15} /> VER MIS PUNTOS
                    </button>
                  ) : user ? (
                    <button
                      onClick={() => setCustomerDrawerOpen(true)}
                      className="bg-[#B85728] hover:bg-[#9E461D] text-white px-6 py-3 text-xs tracking-[0.2em] font-bold uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-xl shadow-md flex items-center gap-2"
                    >
                      <Gift size={15} /> VER MI CUPÓN (BIENVENIDA15)
                    </button>
                  ) : (
                    <button
                      onClick={() => openAuthModal("register")}
                      className="bg-[#B85728] hover:bg-[#9E461D] text-white px-7 py-3 text-xs tracking-[0.2em] font-bold uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-xl shadow-md flex items-center gap-2"
                    >
                      <Sparkles size={15} /> OBTENER 15% OFF
                    </button>
                  )}

                  <span className="text-[10px] text-stone-500 font-medium">
                    *Aplica en 1 solo producto. 1 uso por cliente.
                  </span>
                </div>
              </div>

              {/* Imagen Estética de Productos / Goteros estilo Serum */}
              <div className="md:col-span-5 relative h-44 sm:h-56 md:h-full min-h-[190px] md:min-h-[260px] overflow-hidden flex items-center justify-center p-3 sm:p-4">
                <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-transparent via-transparent to-[#F9EFE7] z-10 hidden md:block"></div>
                <img 
                  src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800&auto=format&fit=crop" 
                  alt="15% Descuento Liliana Salon"
                  className="w-full h-full object-cover object-center rounded-xl md:rounded-none opacity-90 hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-stone-200 text-stone-900 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm z-20">
                  15% OFF
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categorías Circulares (Scroll suave en móviles) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        <h2 className="text-xl sm:text-3xl font-serif tracking-[0.15em] mb-3 uppercase text-gray-900">
          Comprar por Marca & Categoría
        </h2>
        <div className="w-12 h-0.5 bg-[#C08261] mx-auto mb-8 sm:mb-12"></div>

        <div className="flex overflow-x-auto gap-4 sm:gap-10 pb-4 scrollbar-none snap-x snap-mandatory px-2 justify-start sm:justify-center">
          {[
            { name: "Keratech", img: "https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=400&auto=format&fit=crop" },
            { name: "IvoGa", img: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=400&auto=format&fit=crop" },
            { name: "Cuidado Facial", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=400&auto=format&fit=crop" },
            { name: "Accesorios", img: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=400&auto=format&fit=crop" },
            { name: "Ofertas", img: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=400&auto=format&fit=crop" }
          ].map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                if (cat.name === "Ofertas") {
                  setSelectedCategory("TODOS");
                } else {
                  setSelectedCategory(cat.name);
                }
                const elem = document.getElementById("catalogo");
                elem?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex flex-col items-center group cursor-pointer flex-shrink-0 snap-center w-24 sm:w-36 md:w-40 transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              <div className="w-24 h-24 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full border border-stone-200 bg-white mb-2 sm:mb-4 flex items-center justify-center overflow-hidden group-hover:border-[#C08261] group-hover:shadow-lg transition-all duration-500 p-1 shadow-xs">
                <div className="w-full h-full rounded-full overflow-hidden relative">
                  <img 
                    src={cat.img} 
                    alt={cat.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                  />
                </div>
              </div>
              <span className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] font-semibold uppercase text-stone-700 group-hover:text-black transition-colors truncate w-full">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Catálogo de Productos (Optimizado para 2 columnas en móviles) */}
      <section id="catalogo" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full scroll-mt-24 sm:scroll-mt-28">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-8 gap-4 border-b border-stone-200 pb-4 sm:pb-6">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#C08261] font-semibold block mb-1">
              Catálogo en {countryName} {countryFlag}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-wide text-gray-900">
              Nuestros Productos
            </h2>
          </div>

          {/* Filtros de Categoría scrollable */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[11px] sm:text-xs uppercase tracking-wider px-3 sm:px-3.5 py-1.5 rounded-full transition-all font-medium whitespace-nowrap flex-shrink-0 ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-black text-white"
                    : "bg-white text-stone-600 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Productos: 2 columnas en móvil, 4 en desktop */}
        {loading ? (
          <div className="py-20 text-center text-stone-400 text-sm">
            Cargando catálogo de productos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-stone-500 text-sm">No hay productos en la categoría &quot;{selectedCategory}&quot;.</p>
            <button 
              onClick={() => setSelectedCategory("TODOS")} 
              className="mt-3 text-xs font-semibold uppercase tracking-wider underline text-black"
            >
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6 lg:gap-8">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock === 0;

              return (
                <div 
                  key={product.id} 
                  className="group flex flex-col justify-between bg-white p-2.5 sm:p-3.5 rounded-2xl border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] sm:hover:-translate-y-1.5 transition-all duration-300 ease-out"
                >
                  <div>
                    {/* Contenedor de la foto (Haz clic para ver expandido) */}
                    <div 
                      onClick={() => setSelectedProduct(product)}
                      className="relative aspect-[4/5] bg-[#FAF6F2] mb-3 sm:mb-4 overflow-hidden flex items-center justify-center rounded-xl sm:rounded-2xl border border-stone-200/70 cursor-pointer transition-all duration-300"
                    >
                      {/* Badge de Tag */}
                      {product.tag && (
                        <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-[#C08261] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 z-10 uppercase tracking-widest rounded shadow-xs">
                          {product.tag}
                        </span>
                      )}

                      {/* Stock Badge */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-red-600 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 z-10 uppercase tracking-wider rounded">
                          Agotado
                        </span>
                      ) : product.stock <= 3 ? (
                        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-amber-600 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 z-10 uppercase tracking-wider rounded">
                          Últimas {product.stock}
                        </span>
                      ) : null}

                      {/* Volumen / ml badge (si aplica) */}
                      {product.volume && (
                        <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-white/95 backdrop-blur-xs text-stone-800 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 z-10 rounded border border-stone-200 shadow-xs">
                          {product.volume}
                        </span>
                      )}

                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out" 
                      />

                      {/* Hover Overlay Desktop */}
                      <div className="hidden sm:flex absolute inset-0 bg-black/25 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center">
                        <span className="bg-white/95 backdrop-blur-md text-stone-900 text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                          <Eye size={14} className="text-[#C08261]" /> Ver detalles
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] sm:text-[11px] text-[#A06C52] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-semibold block truncate">
                        {product.brand || product.category}
                      </span>
                    </div>

                    <h3 
                      onClick={() => setSelectedProduct(product)}
                      className="text-xs sm:text-sm font-medium text-gray-900 mb-1.5 leading-snug cursor-pointer hover:text-[#C08261] transition-colors line-clamp-2"
                    >
                      {product.name}
                    </h3>
                  </div>

                  <div className="pt-1 sm:pt-2">
                    {/* Precios con Divisa Adaptable */}
                    <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                      <span className="text-sm sm:text-base font-bold text-gray-900">
                        {formatPrice(product.price, product.priceUSD)}
                      </span>
                      {product.oldPrice && (
                        <span className="line-through text-stone-400 text-[10px] sm:text-xs font-normal">
                          {formatPrice(product.oldPrice, product.oldPriceUSD)}
                        </span>
                      )}
                    </div>

                    {/* Botones de Acción: Carrito y WhatsApp Directo */}
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <button
                        disabled={isOutOfStock}
                        onClick={() => addToCart(product, 1)}
                        className={`py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all duration-200 shadow-xs ${
                          isOutOfStock
                            ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                            : "bg-black hover:bg-stone-800 text-white hover:scale-[1.02] active:scale-[0.98]"
                        }`}
                        title={isOutOfStock ? "Producto agotado en inventario" : "Añadir a mi bolsa de compras"}
                      >
                        <ShoppingBag size={12} className="flex-shrink-0" />
                        <span className="truncate">{isOutOfStock ? "Agotado" : "Bolsa"}</span>
                      </button>

                      <a
                        href={getWhatsAppProductLink(product)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-stone-200 hover:border-black bg-white hover:bg-stone-50 text-stone-900 py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all duration-200"
                        title="Pedir directo por WhatsApp"
                      >
                        <MessageCircle size={12} className="text-[#25D366] flex-shrink-0" />
                        <span className="truncate">Pedir</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Promociones Banners */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-[#1A1816] text-white p-6 sm:p-12 flex flex-col justify-center items-start min-h-[260px] sm:min-h-[320px] rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=800&auto=format&fit=crop')] opacity-25 mix-blend-luminosity group-hover:opacity-35 transition-opacity duration-500 object-cover w-full h-full"></div>
            <div className="relative z-10">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#C08261] font-semibold mb-2 block">
                Cuidado Profesional
              </span>
              <h3 className="text-2xl sm:text-3xl font-serif font-light mb-2 sm:mb-3">Línea <b className="font-semibold">Keratech</b></h3>
              <p className="mb-4 sm:mb-6 text-stone-300 text-xs sm:text-sm max-w-sm leading-relaxed">
                Reparación profunda, sellado de puntas y fórmulas libres de sulfatos para mantener tu cabello radiante.
              </p>
              <button 
                onClick={() => {
                  setSelectedCategory("Keratech");
                  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
                }} 
                className="border border-white/80 px-5 sm:px-6 py-2 sm:py-2.5 text-[11px] sm:text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-all"
              >
                Ver Keratech
              </button>
            </div>
          </div>

          <div className="bg-[#EFE6DF] p-6 sm:p-12 flex flex-col justify-center items-start min-h-[260px] sm:min-h-[320px] rounded-2xl relative overflow-hidden group text-gray-900 border border-stone-200">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop')] opacity-25 group-hover:opacity-35 transition-opacity duration-500 object-cover w-full h-full"></div>
            <div className="relative z-10">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-bold mb-2 block text-[#A06C52]">
                100% Orgánico
              </span>
              <h3 className="text-2xl sm:text-3xl font-serif font-light mb-2 sm:mb-3">Alisados <b className="font-semibold">IvoGa</b></h3>
              <p className="mb-4 sm:mb-6 text-stone-700 text-xs sm:text-sm max-w-sm leading-relaxed">
                Alisado sin formol, sin vapores molestos. Cero daño y máximo brillo con extractos botánicos naturales.
              </p>
              <button 
                onClick={() => {
                  setSelectedCategory("IvoGa");
                  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
                }} 
                className="border border-stone-900 px-5 sm:px-6 py-2 sm:py-2.5 text-[11px] sm:text-xs tracking-widest uppercase hover:bg-stone-900 hover:text-white transition-all"
              >
                Ver IvoGa
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL EXPANDIDO DE PRODUCTO (Optimizado para móvil y multidivisa) */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto transition-opacity duration-300 animate-in fade-in"
          onClick={() => {
            setSelectedProduct(null);
            setModalQty(1);
          }}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 relative my-0 sm:my-8 transform transition-all duration-300 ease-out animate-in zoom-in-95 sm:fade-in"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Botón Cerrar */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProduct(null);
                setModalQty(1);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-black hover:text-white text-stone-700 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all border border-stone-200 touch-manipulation cursor-pointer"
              aria-label="Cerrar ventana"
            >
              <X size={18} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
              {/* Imagen Grande Expandida */}
              <div className="md:col-span-6 bg-[#FAF6F2] relative flex items-center justify-center p-6 sm:p-10 border-b md:border-b-0 md:border-r border-stone-100 min-h-[280px] sm:min-h-[350px]">
                {selectedProduct.tag && (
                  <span className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-[#C08261] text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 z-10 uppercase tracking-widest rounded-lg shadow-xs">
                    {selectedProduct.tag}
                  </span>
                )}
                <div className="w-full max-w-[260px] sm:max-w-[340px] aspect-[4/5] rounded-2xl overflow-hidden shadow-xs border border-stone-200/60 bg-white">
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                  />
                </div>
              </div>

              {/* Información y Precios en Alto */}
              <div className="md:col-span-6 p-5 sm:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[11px] sm:text-xs uppercase tracking-[0.25em] font-bold text-[#A06C52]">
                      {selectedProduct.brand || selectedProduct.category}
                    </span>
                    {selectedProduct.volume && (
                      <>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                          {selectedProduct.volume}
                        </span>
                      </>
                    )}
                    <span className="text-stone-300">•</span>
                    <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
                      {countryFlag} {countryName}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-3xl font-serif text-gray-900 leading-tight mb-4">
                    {selectedProduct.name}
                  </h2>

                  {/* PRECIOS EN ALTO (Multidivisa GT/SV) */}
                  <div className="bg-[#FAF6F2] p-4 sm:p-5 rounded-2xl border border-stone-200 mb-4 sm:mb-6">
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                      Precio Oficial ({country === "GT" ? "Quetzales" : "Dólares USD"})
                    </span>
                    <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 tracking-tight">
                        {formatPrice(selectedProduct.price, selectedProduct.priceUSD)}
                      </span>
                      {selectedProduct.oldPrice && (
                        <span className="text-base sm:text-lg line-through text-stone-400 font-normal">
                          {formatPrice(selectedProduct.oldPrice, selectedProduct.oldPriceUSD)}
                        </span>
                      )}
                    </div>

                    {/* Llamado de bienvenida con 15% OFF (Solo clientes, no admin) */}
                    {!isAdmin && userProfile && !userProfile.firstPurchaseUsed ? (
                      <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between text-xs">
                        <span className="text-[#A06C52] font-semibold flex items-center gap-1">
                          <Gift size={13} /> Tu 15% OFF de Bienvenida:
                        </span>
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          Pagas solo {country === "SV" 
                            ? `$${(getRawPrice(selectedProduct.price, selectedProduct.priceUSD) * 0.85).toFixed(2)} USD` 
                            : `Q${(getRawPrice(selectedProduct.price, selectedProduct.priceUSD) * 0.85).toFixed(2)}`}
                        </span>
                      </div>
                    ) : !isAdmin && !user ? (
                      <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between text-xs">
                        <span className="text-stone-600 text-[11px] sm:text-xs">
                          ¿Primera compra? Paga <strong className="text-black font-bold">
                            {country === "SV" 
                              ? `$${(getRawPrice(selectedProduct.price, selectedProduct.priceUSD) * 0.85).toFixed(2)} USD` 
                              : `Q${(getRawPrice(selectedProduct.price, selectedProduct.priceUSD) * 0.85).toFixed(2)}`}
                          </strong> (15% OFF)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(null);
                            openAuthModal("register");
                          }}
                          className="text-[#C08261] font-bold underline hover:text-black transition ml-2 whitespace-nowrap"
                        >
                          Crear Cuenta
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Stock y Disponibilidad */}
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedProduct.stock === 0 ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                    }`}></span>
                    <span className="text-xs font-medium text-stone-700">
                      {selectedProduct.stock === 0
                        ? "Producto Agotado en Inventario"
                        : `Disponible en Salón (${selectedProduct.stock} unidades en existencia)`}
                    </span>
                  </div>

                  {/* Beneficio de Mayoreo / Docena */}
                  <div className="bg-[#FAF3EC] border border-[#E8D6C6] rounded-xl p-2.5 mb-4 text-[11px] text-stone-700 flex items-center gap-2">
                    <span className="text-base">📦</span>
                    <span>
                      <strong className="text-black font-semibold">10% OFF por Docena:</strong> Si llevas 12 o más unidades (o alcanzas 12 artículos en tu bolsa), se aplica el descuento al por mayor automático.
                    </span>
                  </div>

                  {/* Detalles / Descripción */}
                  <div className="space-y-1.5 sm:space-y-2 mb-6 sm:mb-8">
                    <h4 className="text-xs uppercase tracking-wider font-bold text-stone-900">
                      Detalles & Beneficios:
                    </h4>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
                      {selectedProduct.description || "Fórmula profesional de alta eficacia para el cuidado y embellecimiento capilar. Producto garantizado por Liliana Salon."}
                    </p>
                  </div>
                </div>

                {/* Botones de Acción en el Modal: Carrito y WhatsApp Directo */}
                {(() => {
                  const availableStock = selectedProduct.stock !== undefined ? Number(selectedProduct.stock) : 99;
                  const isOutOfStock = availableStock <= 0;
                  const isAtMaxStock = modalQty >= availableStock;

                  return (
                    <div className="space-y-3 pt-3 sm:pt-4 border-t border-stone-100 relative z-10">
                      <div className="flex items-center gap-3">
                        {/* Selector de Cantidad */}
                        <div className="flex items-center border border-stone-200 rounded-xl bg-[#FAF9F7] p-1 shadow-2xs select-none">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalQty(prev => Math.max(1, prev - 1));
                            }}
                            className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg bg-white hover:bg-stone-100 text-stone-700 flex items-center justify-center transition shadow-2xs disabled:opacity-30 touch-manipulation cursor-pointer active:scale-90"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-10 text-center text-sm font-bold text-gray-900 select-none">
                            {modalQty}
                          </span>
                          <button
                            type="button"
                            disabled={isOutOfStock || isAtMaxStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (modalQty < availableStock) {
                                setModalQty(prev => prev + 1);
                              }
                            }}
                            className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition shadow-2xs touch-manipulation active:scale-90 ${
                              isOutOfStock || isAtMaxStock
                                ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                                : "bg-white hover:bg-stone-100 text-stone-700 cursor-pointer"
                            }`}
                            aria-label="Aumentar cantidad"
                            title={isAtMaxStock ? `Stock máximo: ${availableStock}` : "Aumentar cantidad"}
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        {/* Botón Añadir a la Bolsa */}
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOutOfStock) {
                              addToCart(selectedProduct, modalQty);
                              setSelectedProduct(null);
                              setModalQty(1);
                            }
                          }}
                          className={`flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all touch-manipulation select-none ${
                            isOutOfStock
                              ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                              : "bg-black hover:bg-stone-800 text-white cursor-pointer active:scale-[0.98]"
                          }`}
                        >
                          <ShoppingBag size={18} /> {isOutOfStock ? "Producto Agotado" : "Añadir a la Bolsa"}
                        </button>
                      </div>

                      <a
                        href={getWhatsAppProductLink(selectedProduct)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full border border-stone-300 hover:border-black bg-white hover:bg-stone-50 text-stone-900 py-3 px-4 rounded-xl text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all duration-200 touch-manipulation"
                      >
                        <MessageCircle size={16} className="text-[#25D366]" /> Pedir por WhatsApp ({countryName})
                      </a>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 text-center flex items-center justify-center gap-1">
                        <ShieldCheck size={13} className="text-stone-400" />
                        Envíos en Guatemala y El Salvador • Pagos seguros
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 pt-12 sm:pt-16 pb-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h4 className="text-xl sm:text-2xl font-serif tracking-[0.2em] text-gray-900 mb-2">LILIANA SALON</h4>
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
            Belleza & Cuidado Capilar Profesional • WhatsApp +502 4208-3721
          </p>
          <p className="text-[11px] text-stone-400 mb-6 flex items-center justify-center gap-1.5">
            <MapPin size={12} className="text-[#C08261]" /> Cobertura en Guatemala 🇬🇹 y El Salvador 🇸🇻
          </p>
          <p className="text-[11px] text-stone-400">
            © {new Date().getFullYear()} Liliana Salon. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* Botón Flotante de Bolsa de Compras cuando hay productos */}
      {totalItems > 0 && !selectedProduct && (
        <div className="fixed bottom-5 left-5 sm:bottom-7 sm:left-7 z-40 animate-in slide-in-from-bottom duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="bg-stone-900 hover:bg-black text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider hover:scale-105 active:scale-95 transition-all border border-stone-700"
            aria-label="Ver bolsa de compras"
          >
            <div className="relative">
              <ShoppingBag size={18} className="text-[#E0A98B]" />
              <span className="absolute -top-2 -right-2 bg-[#B85728] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            </div>
            <span>Ver Bolsa</span>
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[11px] font-medium ml-0.5">
              {currencySymbol}{total.toFixed(2)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
