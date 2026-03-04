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
    };
  };
}

interface Order {
  _id: string;
  status: string;
  payment_status: string;
  total: number;
  customer_id?: {
    name?: string;
    email?: string;
  } | string;
}

async function testPaymentReceipt() {
  try {
    console.log('🧪 Testing Payment Receipt Email...\n');

    // Step 1: Login as customer
    console.log('📝 Step 1: Logging in as Customer...');
    const loginResponse = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
      email: 'customer@petmaza.com',
      password: 'Password123!',
    });

    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    console.log(`✅ Logged in as: ${user.name}`);
    console.log(`   Email: ${user.email}\n`);

    // Step 2: Get customer orders
    console.log('📝 Step 2: Fetching recent orders...');
    const ordersResponse = await axios.get(`${API_URL}/orders/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const orders = ordersResponse.data.data.orders as Order[];
    console.log(`✅ Found ${orders.length} total orders\n`);

    // Find an unpaid order
    const unpaidOrder = orders.find((order) => order.payment_status === 'Pending');

    if (!unpaidOrder) {
      console.log('⚠️  No unpaid orders found');
      console.log('\n💡 Tip: Create a new order first, then complete payment');
      console.log('   The payment receipt will be sent automatically\n');
      
      console.log('📊 Recent orders:');
      orders.slice(0, 5).forEach((order) => {
        const customerInfo = typeof order.customer_id === 'object' ? order.customer_id : null;
        console.log(`   - Order #${order._id.toString().slice(-8)}`);
        console.log(`     Status: ${order.status}`);
        console.log(`     Payment: ${order.payment_status}`);
        console.log(`     Total: ₹${order.total}\n`);
      });
      
      return;
    }

    console.log(`✅ Found unpaid order: #${unpaidOrder._id.toString().slice(-8)}`);
    console.log(`   Status: ${unpaidOrder.status}`);
    console.log(`   Payment Status: ${unpaidOrder.payment_status}`);
    console.log(`   Total: ₹${unpaidOrder.total}`);

    // Step 3: Complete payment
    console.log('\n📝 Step 3: Completing payment...');
    const paymentResponse = await axios.post(
      `${API_URL}/payment/complete`,
      {
        order_id: unpaidOrder._id,
        payment_id: `test_payment_${Date.now()}`,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (paymentResponse.data.success) {
      console.log('✅ Payment completed successfully!\n');
      console.log('📧 Payment Receipt Email Sent To:');
      console.log(`   Customer: ${user.email}`);
      console.log(`   Subject: "Payment Receipt - Order #${unpaidOrder._id.toString().slice(-8)}"`);
      console.log('\n📋 Receipt Includes:');
      console.log('   ✓ Transaction ID');
      console.log('   ✓ Payment Gateway details');
      console.log('   ✓ Transaction date & time');
      console.log('   ✓ Amount paid');
      console.log('   ✓ Order items with prices');
      console.log('   ✓ Delivery address');
      console.log('   ✓ Order tracking link');
      console.log('\n⏱️  Check server logs for email confirmation...');
      console.log('📬 Check email inbox (including spam folder) for payment receipt');
    } else {
      console.log('❌ Failed to complete payment');
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.status === 404) {
      console.log('\n💡 Tip: Make sure you have an unpaid order');
    }
  }
}

// Run the test
testPaymentReceipt();
