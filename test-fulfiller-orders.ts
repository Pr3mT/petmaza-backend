import mongoose from 'mongoose';

async function testFulfillerOrders() {
  try {
    console.log('\n🔗 Connecting to MongoDB...');
    
    // Use hardcoded URI for testing (same as in .env)
    const mongoUri = 'mongodb+srv://RivrTechlabs:RivrTech%402100@rivrcluster.k62al.mongodb.net/pet-marketplace?appName=RIVRCluster';
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const User = (await import('./src/models/User')).default;
    const VendorDetails = (await import('./src/models/VendorDetails')).default;
    const Order = (await import('./src/models/Order')).default;
    const Product = (await import('./src/models/Product')).default;

    console.log('📋 STEP 1: Check Warehouse Fulfillers\n');
    const fulfillers = await User.find({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
    }).select('name email');

    if (fulfillers.length === 0) {
      console.log('❌ No warehouse fulfillers found!');
      console.log('   Please create fulfillers via Admin → Fulfiller Master\n');
      process.exit(0);
    }

    console.log(`✅ Found ${fulfillers.length} warehouse fulfiller(s):\n`);
    for (const fulfiller of fulfillers) {
      const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
      console.log(`   👤 ${fulfiller.name} (${fulfiller.email})`);
      console.log(`      Assigned Subcategories: ${details?.assignedSubcategories?.join(', ') || 'None'}`);
      console.log('');
    }

    console.log('📋 STEP 2: Check Products in Assigned Subcategories\n');
    for (const fulfiller of fulfillers) {
      const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
      if (details?.assignedSubcategories?.length) {
        const products = await Product.find({
          subCategory: { $in: details.assignedSubcategories },
        }).select('name subCategory');
        
        console.log(`   📦 ${fulfiller.name} can fulfill ${products.length} products:`);
        for (const subcategory of details.assignedSubcategories) {
          const count = products.filter(p => p.subCategory === subcategory).length;
          console.log(`      - ${subcategory}: ${count} products`);
        }
        console.log('');
      }
    }

    console.log('📋 STEP 3: Check Broadcast Orders (Pending, assignedVendorId: null)\n');
    const broadcastOrders = await Order.find({
      status: 'PENDING',
      assignedVendorId: null,
    })
      .populate('customer_id', 'name email')
      .populate('items.product_id', 'name subCategory')
      .sort({ createdAt: -1 })
      .limit(10);

    if (broadcastOrders.length === 0) {
      console.log('❌ No broadcast orders found!');
      console.log('   Orders might be directly assigned or no pending orders exist.\n');
    } else {
      console.log(`✅ Found ${broadcastOrders.length} broadcast order(s):\n`);
      for (const order of broadcastOrders) {
        const customer = order.customer_id as any;
        console.log(`   📦 Order #${order._id.toString().slice(-8)}`);
        console.log(`      Customer: ${customer?.name || 'Unknown'}`);
        console.log(`      Total: ₹${order.total}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Deadline: ${order.acceptanceDeadline ? new Date(order.acceptanceDeadline).toLocaleString() : 'N/A'}`);
        console.log(`      Items:`);
        for (const item of order.items) {
          const product = item.product_id as any;
          console.log(`         - ${product?.name} (${product?.subCategory}) x${item.quantity}`);
        }
        console.log('');
      }
    }

    console.log('📋 STEP 4: Check What Each Fulfiller Should See\n');
    for (const fulfiller of fulfillers) {
      const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
      const assignedSubcategories = details?.assignedSubcategories || [];

      // Find products in assigned subcategories
      const subcategoryProductIds = await Product.find({
        subCategory: { $in: assignedSubcategories },
      }).distinct('_id');

      // Find orders this fulfiller should see
      const visibleOrders = await Order.find({
        $or: [
          { assignedVendorId: fulfiller._id },
          {
            assignedVendorId: null,
            status: 'PENDING',
            'items.product_id': { $in: subcategoryProductIds },
          },
        ],
        status: {
          $in: ['PENDING', 'ACCEPTED', 'PACKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'],
        },
      });

      console.log(`   👤 ${fulfiller.name} should see ${visibleOrders.length} order(s):`);
      
      if (visibleOrders.length === 0) {
        console.log(`      ❌ No orders visible!`);
        if (assignedSubcategories.length === 0) {
          console.log(`      ⚠️  No subcategories assigned to this fulfiller`);
        } else if (subcategoryProductIds.length === 0) {
          console.log(`      ⚠️  No products found in subcategories: ${assignedSubcategories.join(', ')}`);
        }
      } else {
        for (const order of visibleOrders) {
          const isBroadcast = !order.assignedVendorId;
          console.log(`      ${isBroadcast ? '📢 BROADCAST' : '✅ ASSIGNED'} Order #${order._id.toString().slice(-8)} - ${order.status} - ₹${order.total}`);
        }
      }
      console.log('');
    }

    console.log('✅ Test completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFulfillerOrders();
