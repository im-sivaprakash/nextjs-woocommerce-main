import { mergeCartItems } from "@/lib/cart/merge";
import type { PersistentCartItem } from "@/lib/woocommerce/persistent-cart";

describe("mergeCartItems", () => {
  it("returns an empty array when both inputs are empty", () => {
    const result = mergeCartItems([], []);
    expect(result).toEqual([]);
  });

  it("returns items from list A if list B is empty", () => {
    const listA: PersistentCartItem[] = [
      { id: 101, quantity: 2 },
      { id: 102, quantity: 1, variation: [{ attribute: "pa_size", value: "L" }] },
    ];
    const result = mergeCartItems(listA, []);
    expect(result).toEqual([
      { id: 101, quantity: 2 },
      { id: 102, quantity: 1, variation: [{ attribute: "pa_size", value: "L" }] },
    ]);
  });

  it("returns items from list B if list A is empty", () => {
    const listB: PersistentCartItem[] = [
      { id: 201, quantity: 3 },
    ];
    const result = mergeCartItems([], listB);
    expect(result).toEqual([
      { id: 201, quantity: 3 },
    ]);
  });

  it("combines non-overlapping items from both lists", () => {
    const listA: PersistentCartItem[] = [{ id: 1, quantity: 2 }];
    const listB: PersistentCartItem[] = [{ id: 2, quantity: 3 }];

    const result = mergeCartItems(listA, listB);
    expect(result).toEqual([
      { id: 1, quantity: 2 },
      { id: 2, quantity: 3 },
    ]);
  });

  it("sums quantities for identical items with no variations", () => {
    const listA: PersistentCartItem[] = [{ id: 50, quantity: 2 }];
    const listB: PersistentCartItem[] = [{ id: 50, quantity: 3 }];

    const result = mergeCartItems(listA, listB);
    expect(result).toEqual([
      { id: 50, quantity: 5 },
    ]);
  });

  it("sums quantities for items with identical variations", () => {
    const listA: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 1,
        variation: [
          { attribute: "color", value: "blue" },
          { attribute: "size", value: "M" },
        ],
      },
    ];
    const listB: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 4,
        variation: [
          { attribute: "color", value: "blue" },
          { attribute: "size", value: "M" },
        ],
      },
    ];

    const result = mergeCartItems(listA, listB);
    expect(result).toEqual([
      {
        id: 100,
        quantity: 5,
        variation: [
          { attribute: "color", value: "blue" },
          { attribute: "size", value: "M" },
        ],
      },
    ]);
  });

  it("matches variations regardless of attribute ordering", () => {
    const listA: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 2,
        variation: [
          { attribute: "size", value: "M" },
          { attribute: "color", value: "blue" },
        ],
      },
    ];
    const listB: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 3,
        variation: [
          { attribute: "color", value: "blue" },
          { attribute: "size", value: "M" },
        ],
      },
    ];

    const result = mergeCartItems(listA, listB);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(100);
    expect(result[0].quantity).toBe(5);
  });

  it("keeps items with same id but different variations as separate entries", () => {
    const listA: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 1,
        variation: [{ attribute: "size", value: "S" }],
      },
    ];
    const listB: PersistentCartItem[] = [
      {
        id: 100,
        quantity: 2,
        variation: [{ attribute: "size", value: "L" }],
      },
    ];

    const result = mergeCartItems(listA, listB);
    expect(result).toEqual([
      {
        id: 100,
        quantity: 1,
        variation: [{ attribute: "size", value: "S" }],
      },
      {
        id: 100,
        quantity: 2,
        variation: [{ attribute: "size", value: "L" }],
      },
    ]);
  });

  it("handles complex multi-item merging", () => {
    const guestCart: PersistentCartItem[] = [
      { id: 1, quantity: 1 },
      { id: 2, quantity: 2, variation: [{ attribute: "color", value: "red" }] },
      { id: 3, quantity: 1 },
    ];
    const savedCart: PersistentCartItem[] = [
      { id: 1, quantity: 3 },
      { id: 2, quantity: 1, variation: [{ attribute: "color", value: "red" }] },
      { id: 2, quantity: 2, variation: [{ attribute: "color", value: "blue" }] },
      { id: 4, quantity: 5 },
    ];

    const result = mergeCartItems(guestCart, savedCart);

    expect(result).toEqual([
      { id: 1, quantity: 4 },
      { id: 2, quantity: 3, variation: [{ attribute: "color", value: "red" }] },
      { id: 3, quantity: 1 },
      { id: 2, quantity: 2, variation: [{ attribute: "color", value: "blue" }] },
      { id: 4, quantity: 5 },
    ]);
  });
});
