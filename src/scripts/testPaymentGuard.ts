/* Proves the payment guard rejects spoofed "Paid" attempts. */
import dotenv from 'dotenv';
import { assertCapturedPaymentForOrder } from '../services/paymentGuard';

dotenv.config();

const cases: Array<{ name: string; args: any; expectReject: boolean }> = [
  { name: 'MANUAL_ fake id (the old backdoor)', args: { razorpayOrderId: 'order_test', paymentId: `MANUAL_${Date.now()}` }, expectReject: true },
  { name: 'pay_test_ fake id', args: { razorpayOrderId: 'order_test', paymentId: 'pay_test_123' }, expectReject: true },
  { name: 'random/forged payment id', args: { razorpayOrderId: 'order_test', paymentId: 'pay_forged_hacker' }, expectReject: true },
  { name: 'no razorpay order session on order', args: { razorpayOrderId: null, paymentId: 'pay_anything' }, expectReject: true },
];

(async () => {
  console.log(`SKIP_PAYMENT=${process.env.SKIP_PAYMENT}\n`);
  let pass = 0;
  for (const c of cases) {
    try {
      await assertCapturedPaymentForOrder(c.args);
      console.log(`${c.expectReject ? '❌ ALLOWED (BAD)' : '✅ allowed'} — ${c.name}`);
      if (!c.expectReject) pass++;
    } catch (e: any) {
      console.log(`${c.expectReject ? '✅ rejected' : '❌ rejected (BAD)'} — ${c.name}  →  "${e.message}"`);
      if (c.expectReject) pass++;
    }
  }
  console.log(`\n${pass}/${cases.length} behaved correctly.`);
  process.exit(pass === cases.length ? 0 : 1);
})();
