import axios from 'axios';

async function testAPI() {
  try {
    console.log('Testing: http://localhost:6969/api/hero-banners/active\n');
    
    const response = await axios.get('http://localhost:6969/api/hero-banners/active');
    
    console.log('=== RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('\n=== BANNER COUNT ===');
    console.log('Banners array length:', response.data.data?.banners?.length || 0);
    
    if (response.data.data?.banners?.length > 0) {
      console.log('\n=== FIRST BANNER DETAILS ===');
      const banner = response.data.data.banners[0];
      console.log('ID:', banner._id);
      console.log('Title:', banner.title);
      console.log('Subtitle:', banner.subtitle);
      console.log('Image:', banner.image);
      console.log('isActive:', banner.isActive);
      console.log('ctaText:', banner.ctaText);
      console.log('ctaLink:', banner.ctaLink);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
