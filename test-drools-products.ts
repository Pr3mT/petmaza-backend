import axios from 'axios';

const API_URL = 'http://localhost:6969/api';

async function testDroolsProducts() {
  try {
    console.log('\n=== Testing Drools Brand Products ===\n');
    
    // First, get all brands to find Drools ID
    const brandsResponse = await axios.get(`${API_URL}/brands`);
    const brands = brandsResponse.data.brands;
    
    console.log(`Total brands: ${brands.length}`);
    console.log('Brand names:', brands.map((b: any) => b.name).join(', '));
    
    const drools = brands.find((b: any) => b.name.toLowerCase() === 'drools');
    
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
    
    const products = productsResponse.data.products;
    
    console.log(`\n📦 Drools Products Found: ${products.length}`);
    
    if (products.length === 0) {
      console.log('\n⚠️  No Drools products in database!');
      
      // Check if there are ANY products with Drools brand
      const allProductsResponse = await axios.get(`${API_URL}/products`);
      const allProducts = allProductsResponse.data.products;
      const droolsProducts = allProducts.filter((p: any) => 
        p.brand_id?._id === drools._id || 
        p.brand_id === drools._id ||
        p.brand?.toLowerCase() === 'drools'
      );
      
      console.log(`Total products with Drools reference: ${droolsProducts.length}`);
      if (droolsProducts.length > 0) {
        console.log('\nDrools products (with isActive status):');
        droolsProducts.forEach((p: any, idx: number) => {
          console.log(`  ${idx + 1}. ${p.name} - isActive: ${p.isActive}`);
        });
      }
    } else {
      console.log('\n✅ Drools Products:');
      products.forEach((p: any, idx: number) => {
        const subcategory = p.subCategory || p.subcategory_id?.name || 'N/A';
        const mainCategory = p.mainCategory || 'N/A';
        console.log(`  ${idx + 1}. ${p.name}`);
        console.log(`     Category: ${mainCategory} > ${subcategory}`);
        console.log(`     Brand: ${p.brand_id?.name || p.brand}`);
        console.log(`     Active: ${p.isActive}`);
      });
      
      // Group by subcategory
      const grouped: any = {};
      products.forEach((p: any) => {
        const subcat = p.subCategory || p.subcategory_id?.name || 'Other';
        if (!grouped[subcat]) grouped[subcat] = [];
        grouped[subcat].push(p);
      });
      
      console.log('\n📊 Grouped by Subcategory:');
      Object.entries(grouped).forEach(([subcat, prods]: [string, any]) => {
        console.log(`  ${subcat}: ${prods.length} products`);
        prods.forEach((p: any) => console.log(`    - ${p.name}`));
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testDroolsProducts();
