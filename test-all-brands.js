const axios = require('axios');

const API_URL = 'http://127.0.0.1:6969/api';

async function testAllBrands() {
  try {
    console.log('\n=== Testing All Brand Products ===\n');
    
   // Get all brands
    const brandsResponse = await axios.get(`${API_URL}/brands`);
    const responseData = brandsResponse.data.data || brandsResponse.data;
    const brands = responseData.brands || [];
    
    console.log(`Total brands: ${brands.length}\n`);
    
    // Test first 5 brands
    for (const brand of brands.slice(0, 10)) {
      const productsResponse = await axios.get(`${API_URL}/products`, {
        params: {
          brand_id: brand._id,
          isActive: 'true'
        }
      });
      
      const productsData = productsResponse.data.data || productsResponse.data;
      const products = productsData.products || [];
      
      console.log(`✅ ${brand.name}: ${products.length} products`);
      if (products.length > 0) {
        products.forEach(p => {
          console.log(`   - ${p.name} (${p.mainCategory} > ${p.subCategory})`);
        });
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAllBrands();
