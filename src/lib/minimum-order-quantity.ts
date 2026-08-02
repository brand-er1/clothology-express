const KNIT_PATTERN = /(?:니트|knit)/i;
const JACKET_PATTERN = /(?:자켓|재킷|jacket)/i;
const LEATHER_PATTERN = /(?:레더|가죽|leather)/i;

export const DEFAULT_MINIMUM_ORDER_QUANTITY = 20;
export const SPECIAL_MINIMUM_ORDER_QUANTITY = 100;

export const getMinimumOrderQuantity = (
  clothType: string,
  material = "",
) => {
  const isKnit = KNIT_PATTERN.test(clothType);
  const isLeatherJacket =
    JACKET_PATTERN.test(clothType) &&
    (LEATHER_PATTERN.test(clothType) || LEATHER_PATTERN.test(material));

  return isKnit || isLeatherJacket
    ? SPECIAL_MINIMUM_ORDER_QUANTITY
    : DEFAULT_MINIMUM_ORDER_QUANTITY;
};
