import { defineEndpoint } from '@directus/extensions-sdk';

const user_id = "4911f4f2-3f6e-49f4-9042-fdd7549ff96d";

export default defineEndpoint({
	id: 'purchase',
	handler: async (router, context) => {
		const { services, getSchema } = context;
		const { ItemsService } = services;

		router.post('/create', async (req, res) => {
			const purchaseItems = req.body;

			const productsCollection = new ItemsService('products', {
				schema: await getSchema(),
			});
			const purchasesCollection = new ItemsService('purchases', {
				schema: await getSchema(),
			});
			const pricesHistoryCollection = new ItemsService('price_history', {
				schema: await getSchema(),
			});

			const purchaseItemsIds = purchaseItems.map(el => el.product_id);
			const purchaseProducts = await productsCollection.readMany(purchaseItemsIds);

			const purchaseItemsForInsert = purchaseItems
				.map(async (item) => {
					const { product_id, size, quantity } = item;
					const { price } = purchaseProducts
						.find(product => product.product_id === product_id).sizes_and_prices
						.find(sizes_and_prices => sizes_and_prices.size === size);

					const [priceId] = await pricesHistoryCollection.getKeysByQuery({
						sort: ['-date_changed'],
						limit: 1,
						search: product_id
					});

					const subtotal = quantity * price;

					const pointsItem = {
						points_earned: (subtotal * 1) / 100,
						user_id
					};

					return {
						...item,
						price_id: priceId,
						subtotal,
						points_id: pointsItem
					};
				});
console.log(purchaseItemsForInsert)
			const { totalPoints, totalBillAmount } = purchaseItemsForInsert.reduce((acc, { subtotal, points_id }) => {
				acc.totalBillAmount += subtotal;
				acc.totalPoints += points_id.points_earned;
				return acc;
			}, { totalPoints: 0, totalBillAmount: 0 });
		
			const insertedPurchaseId = await purchasesCollection.createOne({
				purchase_items: purchaseItemsForInsert,
				user_id,
				total_points: totalPoints,
				total_amount: totalBillAmount,
				payment_status: 1,
			});
			
			res.json(insertedPurchaseId);
		});
	},
});