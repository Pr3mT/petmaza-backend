(async () => {
  try {
    console.log('Step 1: Logging in...');
    const loginResp = await fetch('http://localhost:6969/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'admin@petmaza.com', 
        password: 'Password123!'
      })
    });
    
    const loginData = await loginResp.json();
    
    if (!loginData.success) {
      console.error('Login failed:', loginData);
      process.exit(1);
    }
    
    console.log('✓ Login successful');
    console.log('User role:', loginData.data?.user?.role);
    
    const token = loginData.data.token;
    
    console.log('\nStep 2: Reseeding product...');
    const reseedResp = await fetch('http://localhost:6969/api/admin/reseed-product', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const reseedData = await reseedResp.json();
    
    if (!reseedData.success) {
      console.error('Reseed failed:', reseedData);
      process.exit(1);
    }
    
    console.log('✓ Product reseeded successfully!');
    console.log('\nVariants with IDs:');
    reseedData.data.variants.forEach(v => {
      console.log(`  ${v.displayWeight}: ${v._id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
