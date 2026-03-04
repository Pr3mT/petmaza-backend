// Test warehouse fulfiller accept order email functionality
import axios from 'axios';

const API_URL = 'http://127.0.0.1:6969/api';

async function testAcceptOrderEmail() {
  try {
    console.log('🧪 Testing Warehouse Fulfiller Accept Order Email\n');

    // Step 1: Login as warehouse fulfiller
    console.log('Step 1: Logging in as warehouse fulfiller...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'fulfiller@petmaza.com',
      password: 'Password123!'
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      process.exit(1);
    }

    const token = loginResponse.data.data.token;
    const fulfiller = loginResponse.data.data.user;
    console.log('✅ Logged in as:', fulfiller.name);
    console.log('   Vendor Type:', fulfiller.vendorType);
    console.log('   Email:', fulfiller.email);
    console.log('');

    // Step 2: Get pending orders
    console.log('Step 2: Fetching pending orders...');
    const ordersResponse = await axios.get(`${API_URL}/warehouse-fulfiller/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const orders = ordersResponse.data.data.orders;
    const pendingOrders = orders.filter((o: any) => o.status === 'PENDING');

    console.log(`   Total orders: ${orders.length}`);
    console.log(`   Pending orders: ${pendingOrders.length}`);
    console.log('');

    if (pendingOrders.length === 0) {
      console.log('⚠️  No pending orders to test. Please create an order first.');
      process.exit(0);
    }

    // Step 3: Accept the first pending order
    const orderToAccept = pendingOrders[0];
    console.log('Step 3: Accepting order...');
    console.log(`   Order ID: ${orderToAccept._id}`);
    console.log(`   Order #: #${orderToAccept._id.toString().slice(-8)}`);
    console.log(`   Customer: ${orderToAccept.customer_id?.name || 'N/A'}`);
    console.log(`   Customer Email: ${orderToAccept.customer_id?.email || 'N/A'}`);
    console.log(`   Total: ₹${orderToAccept.total}`);
    console.log('');

    const acceptResponse = await axios.post(
      `${API_URL}/warehouse-fulfiller/orders/${orderToAccept._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (acceptResponse.data.success) {
      console.log('✅ Order accepted successfully!');
      console.log('');
      console.log('📧 Email Verification:');
      console.log('   Check the customer email:', orderToAccept.customer_id?.email);
      console.log('   Subject: Order Accepted - #' + orderToAccept._id.toString().slice(-8) + ' ✓');
      console.log('   Check both Inbox and Spam folders');
      console.log('');
      console.log('🔍 Backend logs should show:');
      console.log('   [acceptOrder] ✅ Order accepted email sent successfully!');
      console.log('   info: Email sent successfully: Order Accepted - #... to ...');
    } else {
      console.error('❌ Failed to accept order:', acceptResponse.data.message);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    process.exit(1);
  }
}

testAcceptOrderEmail();
