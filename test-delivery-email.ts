import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://127.0.0.1:6969/api';

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      _id: string;
      name: string;
      email: string;
      role: string;
      vendorId?: string;
    };
  };
}

interface Order {
  _id: string;
  status: string;
  customer_id?: {
    name?: string;
    email?: string;
  } | string;
  total: number;
}

async function testDeliveryEmail() {
  try {
    console.log('🧪 Testing Warehouse Fulfiller Delivery Email...\n');

    // Step 1: Login as warehouse fulfiller
    console.log('📝 Step 1: Logging in as Warehouse Fulfiller...');
    const loginResponse = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
      email: 'fulfiller@petmaza.com',
      password: 'Password123!',
    });

    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    console.log(`✅ Logged in successfully`);
    console.log(`   Name: ${user?.name || 'N/A'}`);
    console.log(`   Role: ${user?.role || 'N/A'}\n`);

    // Step 2: Get assigned orders
    console.log('📝 Step 2: Fetching assigned orders...');
    const ordersResponse = await axios.get(`${API_URL}/warehouse-fulfiller/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const orders = ordersResponse.data.data.orders as Order[];
    console.log(`✅ Found ${orders.length} total orders`);

    // Find an order that can be delivered (ACCEPTED, PICKED_UP, or IN_TRANSIT)
    const deliverableOrder = orders.find(
      (order) => ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status)
    );

    if (!deliverableOrder) {
      console.log('\n⚠️  No orders available for delivery testing');
      console.log('   Order must be in ACCEPTED, PICKED_UP, or IN_TRANSIT status');
      console.log('\n📊 Current order statuses:');
      orders.forEach((order) => {
        console.log(`   - Order #${order._id.toString().slice(-8)}: ${order.status}`);
      });
      return;
    }

    console.log(`\n✅ Found deliverable order: #${deliverableOrder._id.toString().slice(-8)}`);
    console.log(`   Current Status: ${deliverableOrder.status}`);
    
    const customerInfo = typeof deliverableOrder.customer_id === 'object' ? deliverableOrder.customer_id : null;
    console.log(`   Customer: ${customerInfo?.name || 'Not populated'}`);
    console.log(`   Email: ${customerInfo?.email || 'Not populated'}`);
    console.log(`   Total: ₹${deliverableOrder.total}`);

    // Step 3: If order is ACCEPTED, first mark it as PICKED_UP
    if (deliverableOrder.status === 'ACCEPTED') {
      console.log('\n📝 Step 3a: Marking order as PICKED_UP first...');
      try {
        await axios.post(
          `${API_URL}/warehouse-fulfiller/orders/${deliverableOrder._id}/picked-up`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ Order marked as PICKED_UP');
      } catch (error: any) {
        console.error('❌ Failed to mark as PICKED_UP:', error.response?.data || error.message);
        return;
      }
    }

    // Step 4: Mark order as DELIVERED
    console.log('\n📝 Step 4: Marking order as DELIVERED...');
    const deliveryResponse = await axios.post(
      `${API_URL}/warehouse-fulfiller/orders/${deliverableOrder._id}/delivered`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (deliveryResponse.data.success) {
      console.log('✅ Order marked as DELIVERED successfully!\n');
      console.log('📧 Expected Emails:');
      const customerEmail = typeof deliverableOrder.customer_id === 'object' ? deliverableOrder.customer_id?.email : 'Not available';
      console.log(`   1. Customer Email: ${customerEmail || 'Not available'}`);
      console.log(`      Subject: "Order Delivered Successfully - #${deliverableOrder._id.toString().slice(-8)}"`);
      console.log(`\n   2. Admin Email: ${process.env.ADMIN_EMAILS || 'N/A'}`);
      console.log(`      Subject: "[ADMIN] Order Delivered - #${deliverableOrder._id.toString().slice(-8)}"`);
      console.log('\n⏱️  Check server logs for email sending confirmation...');
      console.log('📬 Check email inbox (including spam folder) for delivery notifications');
    } else {
      console.log('❌ Failed to mark order as delivered');
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 400) {
      console.log('\n💡 Tip: Make sure the order is in PICKED_UP or IN_TRANSIT status');
    }
  }
}

// Run the test
testDeliveryEmail();
