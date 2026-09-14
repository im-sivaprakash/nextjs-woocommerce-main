"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { WooProduct } from "@/lib/woocommerce/types";
import { formatProductPrice, decodeHtml } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/defaultbutton";
import { WishlistButton } from "@/components/wishlist-button";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import { toast } from "sonner";
import { trackSelectItem, trackAddToCart } from "@/lib/utils/gtm-events";
import { productToEcommerceItem } from "@/lib/utils/gtm-items";
import { t } from "@/lib/i18n";
import { ShoppingCart, ShoppingBag, Check, Loader2 } from "lucide-react";

interface ProductCardProps {
  product: WooProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { addItem, openCart } = useCartStore();
  const [isPending, startTransition] = useTransition();
  const [isBuyNowPending, startBuyNowTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);

  const { current, regular, onSale } = formatProductPrice(product.prices);
  const image = product.images[0];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.type === "external") {
      if (product.external_url) {
        window.open(product.external_url, "_blank", "noopener,noreferrer");
      } else {
        router.push(`/product/${product.slug}`);
      }
      return;
    }

    if (product.type === "variable" || product.type === "grouped") {
      router.push(`/product/${product.slug}`);
      return;
    }

    startTransition(async () => {
      const result = await addItem(product.id, 1);
      if (result.error) {
        toast.error(t('product.cantAddToCart'), { description: result.error });
      } else {
        trackAddToCart(productToEcommerceItem(product), product.prices.currency_code);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 2000);
        openCart();
      }
    });
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.type === "external") {
      if (product.external_url) {
        window.open(product.external_url, "_blank", "noopener,noreferrer");
      } else {
        router.push(`/product/${product.slug}`);
      }
      return;
    }

    if (product.type === "variable" || product.type === "grouped") {
      router.push(`/product/${product.slug}`);
      return;
    }

    startBuyNowTransition(async () => {
      const result = await useBuyNowStore.getState().startBuyNow(product.id, 1);
      if (result.error) {
        toast.error(t('product.cantAddToCart'), { description: result.error });
      } else {
        trackAddToCart(productToEcommerceItem(product), product.prices.currency_code);
        router.push("/checkout?buy_now=1");
      }
    });
  };

  return (
    <div className="group relative flex flex-col justify-between h-full rounded-xl transition-all duration-300">
      {/* Top: Image + Badges + Wishlist */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary/60 mb-3">
        <Link
          href={`/product/${product.slug}`}
          className="block w-full h-full"
          onClick={() => trackSelectItem(productToEcommerceItem(product), "Product List", product.prices.currency_code)}
        >
          {image ? (
            <Image
              src={image.src}
              alt={image.alt || decodeHtml(product.name)}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              {t('product.noImageAlt')}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
            <span className="bg-background/95 backdrop-blur-sm text-foreground text-[11px] font-medium tracking-[0.15em] uppercase px-3.5 py-1.5 rounded-full shadow-sm translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              {t('product.viewProduct')}
            </span>
          </div>
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          {onSale && (
            <Badge className="text-[10px] tracking-wider uppercase font-medium px-2 py-0.5 bg-[var(--gold)] text-white border-0 hover:bg-[var(--gold)]">
              {t('product.saleBadge')}
            </Badge>
          )}
          {!product.is_in_stock && (
            <Badge variant="secondary" className="text-[10px] tracking-wider uppercase font-medium px-2 py-0.5">
              {t('product.soldOutBadge')}
            </Badge>
          )}
        </div>

        {/* Wishlist button */}
        <div className="absolute top-3 right-3 z-10">
          <WishlistButton product={product} size="sm" />
        </div>
      </div>

      {/* Info */}
      <Link
        href={`/product/${product.slug}`}
        className="space-y-1 block flex-1"
        onClick={() => trackSelectItem(productToEcommerceItem(product), "Product List", product.prices.currency_code)}
      >
        {product.categories[0] && (
          <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
            {decodeHtml(product.categories[0].name)}
          </p>
        )}
        <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {decodeHtml(product.name)}
        </h3>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="font-semibold text-sm">{current}</span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through">{regular}</span>
          )}
        </div>
        {product.prices.price_range && (
          <p className="text-xs text-muted-foreground">
            {t('product.priceFrom')} {formatProductPrice({ ...product.prices, price: product.prices.price_range.min_amount }).current}
          </p>
        )}
      </Link>

      {/* Action Buttons: Add to Cart & Buy Now */}
      <div className="pt-3 mt-auto grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs font-medium h-9 border-border hover:border-primary/40 px-2"
          onClick={handleAddToCart}
          disabled={!product.is_purchasable || !product.is_in_stock || isPending || isBuyNowPending}
          title={t('product.addToCart')}
        >
          {justAdded ? (
            <><Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />{t('product.added')}</>
          ) : isPending ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />{t('product.adding')}</>
          ) : !product.is_in_stock ? (
            t('product.soldOutBadge')
          ) : product.type === "variable" ? (
            t('product.selectOptions')
          ) : (
            <><ShoppingCart className="mr-1 h-3.5 w-3.5" />{t('product.addToCart')}</>
          )}
        </Button>

        <Button
          size="sm"
          className="w-full text-xs font-semibold h-9 bg-primary hover:bg-primary/90 text-primary-foreground px-2 shadow-xs"
          onClick={handleBuyNow}
          disabled={!product.is_purchasable || !product.is_in_stock || isPending || isBuyNowPending}
          title={t('product.buyNow')}
        >
          {isBuyNowPending ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />{t('product.buyingNow')}</>
          ) : !product.is_in_stock ? (
            t('product.soldOutBadge')
          ) : (
            <><ShoppingBag className="mr-1 h-3.5 w-3.5" />{t('product.buyNow')}</>
          )}
        </Button>
      </div>
    </div>
  );
}
