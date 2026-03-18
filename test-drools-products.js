const axios = require('axios');

const API_URL = 'http://127.0.0.1:6969/api';

async function testDroolsProducts() {
  try {
    console.log('\n=== Testing Drools Brand Products ===\n');
    
    // First, get all brands to find Drools ID
    const brandsResponse = await axios.get(`${API_URL}/brands`);
    
    //console.log('Brands Response:', JSON.stringify(brandsResponse.data, null, 2));
    
    const responseData = brandsResponse.data.data || brandsResponse.data;
    if (!responseData || !responseData.brands) {
      console.error('❌ Invalid brands response structure');
      console.log('Response:', brandsResponse.data);
      return;
    }
    
    const brands = responseData.brands;
    
    console.log(`Total brands: ${brands.length}`);
    console.log('Brand names:', brands.map(b => b.name).join(', '));
    
    const drools = brands.find(b => b.name.toLowerCase() === 'drools');
    
    if (!drools) {
      console.error('❌ Drools brand not found!');
      return;
    }
    
    console.log(`\n✅ Found Drools: ID = ${drools._id}`);
    
    // Now get products for Drools brand
    const productsResponse = await axios.get(`${API_URL}/products`, {
      params: {
        brand_id: drools._id,
        isActive: 'true'
      }
    });
    
    const productsData = productsResponse.data.data || productsResponse.data;
    const products = productsData.products || [];
    
    console.log(`\n📦 Drools Products Found: ${products.length}`);
    
    if (products.length === 0) {
      console.log('\n⚠️  No Drools products in database!');
      
      // Check if there are ANY products with Drools brand
      const allProductsResponse = await axios.get(`${API_URL}/products`);
      const allProductsData = allProductsResponse.data.data || allProductsResponse.data;
      const allProducts = allProductsData.products || [];
      const droolsProducts = allProducts.filter(p => 
        p.brand_id?._id === drools._id || 
        p.brand_id === drools._id ||
        (p.brand && p.brand.toLowerCase() === 'drools')
      );
      
      console.log(`Total products with Drools reference: ${droolsProducts.length}`);
      if (droolsProducts.length > 0) {
        console.log('\nDrools products (with isActive status):');
        droolsProducts.forEach((p, idx) => {
          console.log(`  ${idx + 1}. ${p.name} - isActive: ${p.isActive}`);
        });
      }
    } else {
      console.log('\n✅ Drools Products:');
      products.forEach((p, idx) => {
        const subcategory = p.subCategory || p.subcategory_id?.name || 'N/A';
        const mainCategory = p.mainCategory || 'N/A';
        console.log(`  ${idx + 1}. ${p.name}`);
        console.log(`     Category: ${mainCategory} > ${subcategory}`);
        console.log(`     Brand: ${p.brand_id?.name || p.brand}`);
        console.log(`     Active: ${p.isActive}`);
      });
      
      // Group by subcategory
      const grouped = {};
      products.forEach(p => {
        const subcat = p.subCategory || p.subcategory_id?.name || 'Other';
        if (!grouped[subcat]) grouped[subcat] = [];
        grouped[subcat].push(p);
      });
      
      console.log('\n📊 Grouped by Subcategory:');
      Object.entries(grouped).forEach(([subcat, prods]) => {
        console.log(`  ${subcat}: ${prods.length} products`);
        prods.forEach(p => console.log(`    - ${p.name}`));
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testDroolsProducts();
