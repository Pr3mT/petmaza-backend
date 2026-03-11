// @ts-nocheck
/**
 * Test Equal Charge Distribution for Split Orders
 * 
 * NEW LOGIC: Platform fee and shipping charges split EQUALLY (50-50)
 * NOT proportionally based on order amount
 */

console.log('\n💰 EQUAL CHARGE DISTRIBUTION TEST\n');
console.log('='.repeat(60));

// Example: Customer orders 2 products from different fulfillers
const dogFoodPrice = 160;  // Divesh Fulfiller
const fishAccessoriesPrice = 640;  // Ramesh Fulfiller
const totalPrice = dogFoodPrice + fishAccessoriesPrice;  // ₹800

console.log('\n📦 ORDER DETAILS:');
console.log(`   • Dog Food (Divesh): ₹${dogFoodPrice}`);
console.log(`   • Fish Accessories (Ramesh): ₹${fishAccessoriesPrice}`);
console.log(`   • Total Items: ₹${totalPrice}`);

// Assume no shipping charges (free delivery)
const shippingCharges = 0;
const platformFee = 10;

console.log('\n💸 CHARGES:');
console.log(`   • Shipping Charges: ₹${shippingCharges}`);
console.log(`   • Platform Fee: ₹${platformFee}`);

console.log('\n\n' + '='.repeat(60));
console.log('❌ OLD LOGIC (PROPORTIONAL DISTRIBUTION):');
console.log('='.repeat(60));

// OLD: Proportional distribution based on order amount
const diveshProportion = dogFoodPrice / totalPrice;  // 160/800 = 0.20 = 20%
const rameshProportion = fishAccessoriesPrice / totalPrice;  // 640/800 = 0.80 = 80%

const diveshPlatformFeeOld = Math.round(platformFee * diveshProportion);
const rameshPlatformFeeOld = Math.round(platformFee * rameshProportion);
const diveshShippingOld = Math.round(shippingCharges * diveshProportion);
const rameshShippingOld = Math.round(shippingCharges * rameshProportion);

console.log('\n📊 Divesh (Dog Food ₹160 = 20%):');
console.log(`   • Platform Fee: ₹${diveshPlatformFeeOld} (20% of ₹10)`);
console.log(`   • Shipping: ₹${diveshShippingOld}`);
console.log(`   • Total Charges: ₹${diveshPlatformFeeOld + diveshShippingOld}`);
console.log(`   • Order Total: ₹${dogFoodPrice + diveshPlatformFeeOld + diveshShippingOld}`);

console.log('\n📊 Ramesh (Fish Accessories ₹640 = 80%):');
console.log(`   • Platform Fee: ₹${rameshPlatformFeeOld} (80% of ₹10)`);
console.log(`   • Shipping: ₹${rameshShippingOld}`);
console.log(`   • Total Charges: ₹${rameshPlatformFeeOld + rameshShippingOld}`);
console.log(`   • Order Total: ₹${fishAccessoriesPrice + rameshPlatformFeeOld + rameshShippingOld}`);

console.log('\n⚠️  PROBLEM: Ramesh pays ₹8 platform fee, Divesh pays only ₹2!');

console.log('\n\n' + '='.repeat(60));
console.log('✅ NEW LOGIC (EQUAL DISTRIBUTION - 50/50):');
console.log('='.repeat(60));

// NEW: Equal distribution - each fulfiller gets equal share
const numberOfOrders = 2;
const diveshPlatformFeeNew = Math.round(platformFee / numberOfOrders);  // 10/2 = 5
const rameshPlatformFeeNew = Math.round(platformFee / numberOfOrders);  // 10/2 = 5
const diveshShippingNew = Math.round(shippingCharges / numberOfOrders);  // 0/2 = 0
const rameshShippingNew = Math.round(shippingCharges / numberOfOrders);  // 0/2 = 0

console.log('\n📊 Divesh (Dog Food ₹160):');
console.log(`   • Platform Fee: ₹${diveshPlatformFeeNew} (50% of ₹10) ✅`);
console.log(`   • Shipping: ₹${diveshShippingNew} (50% of ₹0)`);
console.log(`   • Total Charges: ₹${diveshPlatformFeeNew + diveshShippingNew}`);
console.log(`   • Order Total: ₹${dogFoodPrice + diveshPlatformFeeNew + diveshShippingNew}`);

console.log('\n📊 Ramesh (Fish Accessories ₹640):');
console.log(`   • Platform Fee: ₹${rameshPlatformFeeNew} (50% of ₹10) ✅`);
console.log(`   • Shipping: ₹${rameshShippingNew} (50% of ₹0)`);
console.log(`   • Total Charges: ₹${rameshPlatformFeeNew + rameshShippingNew}`);
console.log(`   • Order Total: ₹${fishAccessoriesPrice + rameshPlatformFeeNew + rameshShippingNew}`);

console.log('\n✅ FAIR: Both fulfillers pay ₹5 platform fee each!');

console.log('\n\n' + '='.repeat(60));
console.log('📊 COMPARISON SUMMARY:');
console.log('='.repeat(60));

console.log('\n| Fulfiller | Product Price | OLD Platform Fee | NEW Platform Fee |');
console.log('|-----------|---------------|------------------|------------------|');
console.log(`| Divesh    | ₹${dogFoodPrice.toString().padEnd(12)} | ₹${diveshPlatformFeeOld.toString().padEnd(15)} | ₹${diveshPlatformFeeNew.toString().padEnd(15)} |`);
console.log(`| Ramesh    | ₹${fishAccessoriesPrice.toString().padEnd(12)} | ₹${rameshPlatformFeeOld.toString().padEnd(15)} | ₹${rameshPlatformFeeNew.toString().padEnd(15)} |`);

console.log('\n\n' + '='.repeat(60));
console.log('🧪 TEST WITH SHIPPING CHARGES:');
console.log('='.repeat(60));

const shippingExample = 100;  // ₹100 shipping
const platformFeeExample = 20;  // ₹20 platform fee

console.log(`\n📦 Scenario: Dog Food (₹160) + Fish Accessories (₹640) = ₹800`);
console.log(`💸 Shipping: ₹${shippingExample} | Platform Fee: ₹${platformFeeExample}`);

// Equal split
const shippingPerOrder = Math.round(shippingExample / 2);  // 100/2 = 50
const platformFeePerOrder = Math.round(platformFeeExample / 2);  // 20/2 = 10

console.log('\n✅ NEW EQUAL DISTRIBUTION:');
console.log(`\n   Divesh (Dog Food):`);
console.log(`   • Product: ₹160`);
console.log(`   • Shipping: ₹${shippingPerOrder} (50% of ₹${shippingExample})`);
console.log(`   • Platform Fee: ₹${platformFeePerOrder} (50% of ₹${platformFeeExample})`);
console.log(`   • TOTAL: ₹${160 + shippingPerOrder + platformFeePerOrder}`);

console.log(`\n   Ramesh (Fish Accessories):`);
console.log(`   • Product: ₹640`);
console.log(`   • Shipping: ₹${shippingPerOrder} (50% of ₹${shippingExample})`);
console.log(`   • Platform Fee: ₹${platformFeePerOrder} (50% of ₹${platformFeeExample})`);
console.log(`   • TOTAL: ₹${640 + shippingPerOrder + platformFeePerOrder}`);

console.log('\n\n' + '='.repeat(60));
console.log('🎯 IMPLEMENTATION:');
console.log('='.repeat(60));

console.log('\n✅ Code Changed in: src/controllers/orderController.ts');
console.log('\nOLD:');
console.log('   const proportion = order.total / combinedSubtotal;');
console.log('   order.platformFee = Math.round(charges.platformFee * proportion);');
console.log('   order.shippingCharges = Math.round(charges.shippingCharges * proportion);');

console.log('\nNEW:');
console.log('   order.platformFee = Math.round(charges.platformFee / orders.length);');
console.log('   order.shippingCharges = Math.round(charges.shippingCharges / orders.length);');

console.log('\n✅ Backend server restarted with new logic!');

console.log('\n\n' + '='.repeat(60));
console.log('📋 NEXT STEPS:');
console.log('='.repeat(60));
console.log('\n1. Place a NEW order with:');
console.log('   • Dog Food (₹160) from Divesh');
console.log('   • Fish Accessories (₹640) from Ramesh');
console.log('\n2. Verify each order gets:');
console.log('   • Platform Fee: ₹5 each (not ₹2 and ₹8)');
console.log('   • Shipping: Split equally if any');
console.log('\n3. Check fulfiller emails - both should show equal charges');
console.log('\n='.repeat(60));
console.log('');
