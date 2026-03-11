import axios from 'axios';

async function testFulfillerAPI() {
  try {
    console.log('\n🔍 Testing Fulfiller API Endpoint\n');

    const baseURL = 'http://127.0.0.1:6969';

    // Get all fulfillers
    const adminLoginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@petmaza.com',
      password: 'Admin@123',
    });

    const adminToken = adminLoginResponse.data.token;
    console.log('✅ Admin logged in\n');

    // Get all fulfillers
    const fulfillersResponse = await axios.get(`${baseURL}/api/admin/fulfillers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const fulfillers = fulfillersResponse.data.data.fulfillers;
    console.log(`Found ${fulfillers.length} fulfillers:\n`);

    for (const fulfiller of fulfillers) {
      console.log(`👤 ${fulfiller.name} (${fulfiller.email})`);
      console.log(`   Subcategories: ${fulfiller.assignedSubcategories?.join(', ') || 'None'}`);
      
      // Try to login as this fulfiller
      try {
        // Get fulfiller password - for testing, try common ones
        const testPasswords = ['12345678', 'password', 'Password@123', fulfiller.name.toLowerCase()];
        let fulfillerToken = null;
        
        for (const password of testPasswords) {
          try {
            const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
              email: fulfiller.email,
              password: password,
            });
            fulfillerToken = loginResponse.data.token;
            console.log(`   ✅ Login successful with password: ${password}`);
            break;
          } catch (e: any) {
            // Try next password
          }
        }

        if (!fulfillerToken) {
          console.log(`   ❌ Could not login (password unknown)\n`);
          continue;
        }

        // Get orders for this fulfiller
        const ordersResponse = await axios.get(`${baseURL}/api/warehouse-fulfiller/orders`, {
          headers: { Authorization: `Bearer ${fulfillerToken}` }
        });

        const orders = ordersResponse.data.data.orders || [];
        console.log(`   📦 API returned ${orders.length} orders:`);
        
        if (orders.length === 0) {
          console.log(`      ⚠️  No orders found!`);
        } else {
          for (const order of orders.slice(0, 5)) {
            const isBroadcast = !order.assignedVendorId || order.isBroadcast;
            console.log(`      ${isBroadcast ? '📢 BROADCAST' : '✅ ASSIGNED'} #${order._id.slice(-8)} - ${order.status} - ₹${order.total}`);
            if (order.items && order.items.length > 0) {
              for (const item of order.items.slice(0, 2)) {
                const product = item.product_id;
                console.log(`         - ${product?.name || 'Unknown'} (${product?.subCategory || 'No subcategory'})`);
              }
            }
          }
          if (orders.length > 5) {
            console.log(`      ... and ${orders.length - 5} more orders`);
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Error fetching orders:`, error.response?.data?.message || error.message);
      }
      
      console.log('');
    }

    console.log('✅ Test completed!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFulfillerAPI();
