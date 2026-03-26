import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createCartWithItem, addToCart as apiAddToCart, getCart, updateCartQuantity, getCheckoutUrl } from '../api/fourthwall';

const CART_ID_KEY = 'hyrax_fw_cart_id';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartId, setCartId] = useState(() => localStorage.getItem(CART_ID_KEY));
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const refreshCart = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await getCart(id);
      setCart(data);
    } catch {
      // Cart expired or invalid — clear it
      localStorage.removeItem(CART_ID_KEY);
      setCartId(null);
      setCart(null);
    }
  }, []);

  useEffect(() => {
    if (cartId) refreshCart(cartId);
  }, [cartId, refreshCart]);

  const addItem = useCallback(async (variantId, quantity = 1) => {
    setLoading(true);
    try {
      let data;
      if (cartId) {
        // Add to existing cart
        data = await apiAddToCart(cartId, variantId, quantity);
      } else {
        // Create new cart with this item
        data = await createCartWithItem(variantId, quantity);
        const newId = data.id;
        localStorage.setItem(CART_ID_KEY, newId);
        setCartId(newId);
      }
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  const updateQuantity = useCallback(async (variantId, quantity) => {
    if (!cartId) return;
    setLoading(true);
    try {
      const data = await updateCartQuantity(cartId, [{ variantId, quantity }]);
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  const removeItem = useCallback(async (variantId) => {
    return updateQuantity(variantId, 0);
  }, [updateQuantity]);

  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_ID_KEY);
    setCartId(null);
    setCart(null);
  }, []);

  const checkout = useCallback(() => {
    if (!cartId) return;
    window.location.href = getCheckoutUrl(cartId);
  }, [cartId]);

  return (
    <CartContext.Provider value={{
      cart,
      cartCount,
      loading,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      checkout,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
