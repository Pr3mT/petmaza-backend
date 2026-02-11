import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';

// Load environment variables
dotenv.config();

const seedComprehensiveProducts = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    console.log('✅ Cleared existing products, categories, and brands');

    // ==================== CREATE BRANDS ====================
    console.log('\n📦 Creating brands...');
    const brandsData = [
      // Dog Brands
      { name: 'Pedigree', description: 'Premium dog food brand', isActive: true },
      { name: 'Royal Canin', description: 'Veterinary recommended pet nutrition', isActive: true },
      { name: 'Drools', description: 'Complete nutrition for dogs', isActive: true },
      { name: 'Purepet', description: 'Pure nutrition for pets', isActive: true },
      { name: 'Pedigree Pro', description: 'Professional dog nutrition', isActive: true },
      { name: 'Farmina', description: 'Natural pet food', isActive: true },
      
      // Cat Brands
      { name: 'Whiskas', description: 'Complete cat food', isActive: true },
      { name: 'Meo', description: 'Premium cat food', isActive: true },
      { name: 'Sheba', description: 'Gourmet cat food', isActive: true },
      { name: 'Kit Cat', description: 'Healthy cat nutrition', isActive: true },
      
      // Fish Brands
      { name: 'Tetra', description: 'Aquarium products leader', isActive: true },
      { name: 'API', description: 'Aquarium pharmaceuticals', isActive: true },
      { name: 'Aqueon', description: 'Quality aquarium products', isActive: true },
      { name: 'Fluval', description: 'Premium aquarium equipment', isActive: true },
      { name: 'Marina', description: 'Complete aquarium solutions', isActive: true },
      
      // Bird Brands
      { name: 'Vitapol', description: 'Bird food specialist', isActive: true },
      { name: 'Taiyo', description: 'Premium bird nutrition', isActive: true },
      { name: 'Cockatoo', description: 'Exotic bird food', isActive: true },
      
      // Small Pet Brands
      { name: 'Oxbow', description: 'Small pet nutrition', isActive: true },
      { name: 'Versele-Laga', description: 'Premium small pet food', isActive: true },
      { name: 'Kaytee', description: 'Small animal care', isActive: true },
      
      // General/Accessories
      { name: 'Petmate', description: 'Pet accessories', isActive: true },
      { name: 'Kong', description: 'Durable pet toys', isActive: true },
      { name: 'Flexi', description: 'Pet leashes and leads', isActive: true },
      { name: 'Trixie', description: 'Pet accessories', isActive: true },
      { name: 'Pawzone', description: 'Pet care products', isActive: true },
    ];

    const brands = await Brand.create(brandsData);
    console.log(`✅ Created ${brands.length} brands`);

    // Helper to get brand by name
    const getBrand = (name: string) => brands.find(b => b.name === name)?._id;

    // ==================== CREATE CATEGORIES ====================
    console.log('\n📁 Creating categories...');
    
    // Parent Categories
    const dogCat = await Category.create({ 
      name: 'Dog', 
      description: 'All dog products', 
      isActive: true,
      image: 'https://placehold.co/400x400?text=Dog'
    });
    const catCat = await Category.create({ 
      name: 'Cat', 
      description: 'All cat products', 
      isActive: true,
      image: 'https://placehold.co/400x400?text=Cat'
    });
    const fishCat = await Category.create({ 
      name: 'Fish & Aquatic', 
      description: 'All fish and aquarium products', 
      isActive: true,
      image: 'https://placehold.co/400x400?text=Fish'
    });
    const birdCat = await Category.create({ 
      name: 'Bird', 
      description: 'All bird products', 
      isActive: true,
      image: 'https://placehold.co/400x400?text=Bird'
    });
    const smallPetCat = await Category.create({ 
      name: 'Small Pets', 
      description: 'Products for hamsters, rabbits, guinea pigs', 
      isActive: true,
      image: 'https://placehold.co/400x400?text=Small+Pets'
    });

    // Dog Subcategories
    const dogFood = await Category.create({ name: 'Dog Food', description: 'Food for dogs', parentCategoryId: dogCat._id, isActive: true });
    const dogToys = await Category.create({ name: 'Dog Toys', description: 'Toys for dogs', parentCategoryId: dogCat._id, isActive: true });
    const dogAccessories = await Category.create({ name: 'Dog Accessories', description: 'Accessories for dogs', parentCategoryId: dogCat._id, isActive: true });
    const dogGrooming = await Category.create({ name: 'Dog Grooming', description: 'Grooming products', parentCategoryId: dogCat._id, isActive: true });
    const dogHealth = await Category.create({ name: 'Dog Health', description: 'Health supplements', parentCategoryId: dogCat._id, isActive: true });

    // Cat Subcategories
    const catFood = await Category.create({ name: 'Cat Food', description: 'Food for cats', parentCategoryId: catCat._id, isActive: true });
    const catToys = await Category.create({ name: 'Cat Toys', description: 'Toys for cats', parentCategoryId: catCat._id, isActive: true });
    const catAccessories = await Category.create({ name: 'Cat Accessories', description: 'Accessories for cats', parentCategoryId: catCat._id, isActive: true });
    const catLitter = await Category.create({ name: 'Cat Litter', description: 'Cat litter products', parentCategoryId: catCat._id, isActive: true });
    const catGrooming = await Category.create({ name: 'Cat Grooming', description: 'Grooming products', parentCategoryId: catCat._id, isActive: true });

    // Fish Subcategories
    const fishFood = await Category.create({ name: 'Fish Food', description: 'Food for fish', parentCategoryId: fishCat._id, isActive: true });
    const aquariumTanks = await Category.create({ name: 'Aquarium Tanks', description: 'Fish tanks and aquariums', parentCategoryId: fishCat._id, isActive: true });
    const aquariumDecor = await Category.create({ name: 'Aquarium Decor', description: 'Decorations for aquariums', parentCategoryId: fishCat._id, isActive: true });
    const aquariumLights = await Category.create({ name: 'Aquarium Lights', description: 'Lighting for aquariums', parentCategoryId: fishCat._id, isActive: true });
    const aquariumFilters = await Category.create({ name: 'Aquarium Filters', description: 'Filtration systems', parentCategoryId: fishCat._id, isActive: true });
    const aquariumAccessories = await Category.create({ name: 'Aquarium Accessories', description: 'Other aquarium accessories', parentCategoryId: fishCat._id, isActive: true });

    // Bird Subcategories
    const birdFood = await Category.create({ name: 'Bird Food', description: 'Food for birds', parentCategoryId: birdCat._id, isActive: true });
    const birdCages = await Category.create({ name: 'Bird Cages', description: 'Cages for birds', parentCategoryId: birdCat._id, isActive: true });
    const birdToys = await Category.create({ name: 'Bird Toys', description: 'Toys for birds', parentCategoryId: birdCat._id, isActive: true });
    const birdAccessories = await Category.create({ name: 'Bird Accessories', description: 'Accessories for birds', parentCategoryId: birdCat._id, isActive: true });

    // Small Pet Subcategories
    const hamsterFood = await Category.create({ name: 'Hamster Food', description: 'Food for hamsters', parentCategoryId: smallPetCat._id, isActive: true });
    const rabbitFood = await Category.create({ name: 'Rabbit Food', description: 'Food for rabbits', parentCategoryId: smallPetCat._id, isActive: true });
    const guineaPigFood = await Category.create({ name: 'Guinea Pig Food', description: 'Food for guinea pigs', parentCategoryId: smallPetCat._id, isActive: true });
    const smallPetCages = await Category.create({ name: 'Small Pet Cages', description: 'Cages for small pets', parentCategoryId: smallPetCat._id, isActive: true });
    const smallPetToys = await Category.create({ name: 'Small Pet Toys', description: 'Toys for small pets', parentCategoryId: smallPetCat._id, isActive: true });
    const smallPetAccessories = await Category.create({ name: 'Small Pet Accessories', description: 'Accessories for small pets', parentCategoryId: smallPetCat._id, isActive: true });

    console.log('✅ Created all categories');

    // ==================== CREATE PRODUCTS ====================
    console.log('\n🛍️  Creating products...');
    
    const products: any[] = [];

    // ==================== DOG FOOD PRODUCTS (with variants) ====================
    const dogFoodProducts = [
      {
        name: 'Pedigree Adult Dry Dog Food - Chicken & Vegetables',
        description: 'Complete nutrition for adult dogs with real chicken and vegetables. Rich in protein and essential nutrients.',
        category_id: dogFood._id,
        brand_id: getBrand('Pedigree'),
        images: ['https://placehold.co/400x400?text=Pedigree+Chicken'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 185, sellingPercentage: 85, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 480, sellingPercentage: 85, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 995, sellingPercentage: 87, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 2800, sellingPercentage: 88, isActive: true },
          { weight: 20000, unit: 'g', displayWeight: '20kg', mrp: 5200, sellingPercentage: 90, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Medium Adult Dog Food',
        description: 'Specially formulated for medium breed adult dogs. Supports digestive health and skin coat.',
        category_id: dogFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Royal+Canin+Medium'],
        hasVariants: true,
        variants: [
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 850, sellingPercentage: 85, isActive: true },
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 2950, sellingPercentage: 87, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 6800, sellingPercentage: 88, isActive: true },
          { weight: 15000, unit: 'g', displayWeight: '15kg', mrp: 9500, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Drools Chicken & Egg Adult Dog Food',
        description: 'High protein dog food with chicken and egg. Promotes muscle development.',
        category_id: dogFood._id,
        brand_id: getBrand('Drools'),
        images: ['https://placehold.co/400x400?text=Drools+Chicken'],
        hasVariants: true,
        variants: [
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 425, sellingPercentage: 82, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 925, sellingPercentage: 84, isActive: true },
          { weight: 6500, unit: 'g', displayWeight: '6.5kg', mrp: 1850, sellingPercentage: 86, isActive: true },
          { weight: 15000, unit: 'g', displayWeight: '15kg', mrp: 3950, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Purepet Chicken & Rice Adult Dog Food',
        description: 'Wholesome nutrition with chicken and rice. Easy to digest formula.',
        category_id: dogFood._id,
        brand_id: getBrand('Purepet'),
        images: ['https://placehold.co/400x400?text=Purepet+Adult'],
        hasVariants: true,
        variants: [
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 380, sellingPercentage: 80, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 950, sellingPercentage: 83, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 2850, sellingPercentage: 85, isActive: true },
          { weight: 20000, unit: 'g', displayWeight: '20kg', mrp: 5200, sellingPercentage: 87, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Farmina N&D Chicken & Pomegranate Puppy Food',
        description: 'Natural ingredients for puppies. Grain-free formula with 70% animal ingredients.',
        category_id: dogFood._id,
        brand_id: getBrand('Farmina'),
        images: ['https://placehold.co/400x400?text=Farmina+Puppy'],
        hasVariants: true,
        variants: [
          { weight: 800, unit: 'g', displayWeight: '800g', mrp: 850, sellingPercentage: 85, isActive: true },
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 2400, sellingPercentage: 87, isActive: true },
          { weight: 7000, unit: 'g', displayWeight: '7kg', mrp: 6200, sellingPercentage: 88, isActive: true },
          { weight: 12000, unit: 'g', displayWeight: '12kg', mrp: 10500, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Pedigree Pro Expert Nutrition High Protein Dog Food',
        description: 'Professional grade nutrition with 28% protein. For active and working dogs.',
        category_id: dogFood._id,
        brand_id: getBrand('Pedigree Pro'),
        images: ['https://placehold.co/400x400?text=Pedigree+Pro'],
        hasVariants: true,
        variants: [
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 580, sellingPercentage: 84, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1280, sellingPercentage: 86, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 3850, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Mini Puppy Dog Food',
        description: 'Complete nutrition for small breed puppies up to 10 months.',
        category_id: dogFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Royal+Canin+Puppy'],
        hasVariants: true,
        variants: [
          { weight: 800, unit: 'g', displayWeight: '800g', mrp: 725, sellingPercentage: 85, isActive: true },
          { weight: 2000, unit: 'g', displayWeight: '2kg', mrp: 1650, sellingPercentage: 87, isActive: true },
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 3100, sellingPercentage: 88, isActive: true },
          { weight: 8000, unit: 'g', displayWeight: '8kg', mrp: 5800, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Drools Focus Super Premium Puppy Food',
        description: 'Super premium nutrition for puppies with DHA for brain development.',
        category_id: dogFood._id,
        brand_id: getBrand('Drools'),
        images: ['https://placehold.co/400x400?text=Drools+Puppy'],
        hasVariants: true,
        variants: [
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 495, sellingPercentage: 83, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1095, sellingPercentage: 85, isActive: true },
          { weight: 12000, unit: 'g', displayWeight: '12kg', mrp: 3995, sellingPercentage: 87, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Maxi Adult Dog Food',
        description: 'For large breed dogs. Supports bone and joint health.',
        category_id: dogFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Royal+Canin+Maxi'],
        hasVariants: true,
        variants: [
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 3150, sellingPercentage: 87, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 7200, sellingPercentage: 88, isActive: true },
          { weight: 15000, unit: 'g', displayWeight: '15kg', mrp: 10200, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Pedigree Small Breed Adult Dog Food',
        description: 'Specially formulated for small breed dogs. Smaller kibble size.',
        category_id: dogFood._id,
        brand_id: getBrand('Pedigree'),
        images: ['https://placehold.co/400x400?text=Pedigree+Small'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 195, sellingPercentage: 84, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 495, sellingPercentage: 86, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1050, sellingPercentage: 87, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Farmina N&D Lamb & Blueberry Adult Dog Food',
        description: 'Grain-free formula with 60% animal ingredients. Lamb protein.',
        category_id: dogFood._id,
        brand_id: getBrand('Farmina'),
        images: ['https://placehold.co/400x400?text=Farmina+Lamb'],
        hasVariants: true,
        variants: [
          { weight: 800, unit: 'g', displayWeight: '800g', mrp: 895, sellingPercentage: 85, isActive: true },
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 2550, sellingPercentage: 87, isActive: true },
          { weight: 7000, unit: 'g', displayWeight: '7kg', mrp: 6500, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Purepet Senior Dog Food - Chicken & Rice',
        description: 'Formulated for senior dogs 7+ years. Joint care formula.',
        category_id: dogFood._id,
        brand_id: getBrand('Purepet'),
        images: ['https://placehold.co/400x400?text=Purepet+Senior'],
        hasVariants: true,
        variants: [
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 420, sellingPercentage: 81, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1050, sellingPercentage: 84, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 3150, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...dogFoodProducts);

    // ==================== MORE DOG FOOD PRODUCTS ====================
    const moreDogFoodProducts = [
      {
        name: 'Drools Chicken & Vegetables Dog Food',
        description: 'Real chicken with farm-fresh vegetables. Complete nutrition.',
        category_id: dogFood._id,
        brand_id: getBrand('Drools'),
        images: ['https://placehold.co/400x400?text=Drools+Veg'],
        hasVariants: true,
        variants: [
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 895, sellingPercentage: 84, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 2650, sellingPercentage: 86, isActive: true },
          { weight: 20000, unit: 'g', displayWeight: '20kg', mrp: 4850, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Mini Digestive Care',
        description: 'For small breeds with sensitive digestion. Highly digestible proteins.',
        category_id: dogFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Digestive+Care'],
        hasVariants: true,
        variants: [
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 895, sellingPercentage: 85, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 2450, sellingPercentage: 87, isActive: true },
          { weight: 8000, unit: 'g', displayWeight: '8kg', mrp: 6150, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Pedigree High Protein Performance Food',
        description: 'High protein formula for active working dogs. 30% protein.',
        category_id: dogFood._id,
        brand_id: getBrand('Pedigree'),
        images: ['https://placehold.co/400x400?text=High+Protein'],
        hasVariants: true,
        variants: [
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1195, sellingPercentage: 86, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 3450, sellingPercentage: 88, isActive: true },
          { weight: 20000, unit: 'g', displayWeight: '20kg', mrp: 6250, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Farmina N&D Fish & Orange Adult Food',
        description: 'Ocean fish formula. Rich in Omega-3 for healthy skin.',
        category_id: dogFood._id,
        brand_id: getBrand('Farmina'),
        images: ['https://placehold.co/400x400?text=Farmina+Fish'],
        hasVariants: true,
        variants: [
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 2650, sellingPercentage: 87, isActive: true },
          { weight: 7000, unit: 'g', displayWeight: '7kg', mrp: 6750, sellingPercentage: 88, isActive: true },
          { weight: 12000, unit: 'g', displayWeight: '12kg', mrp: 11250, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...moreDogFoodProducts);

    // ==================== CAT FOOD PRODUCTS (with variants) ====================
    const catFoodProducts = [
      {
        name: 'Whiskas Adult Dry Cat Food - Ocean Fish',
        description: 'Complete balanced nutrition with ocean fish flavor. Supports urinary health.',
        category_id: catFood._id,
        brand_id: getBrand('Whiskas'),
        images: ['https://placehold.co/400x400?text=Whiskas+Fish'],
        hasVariants: true,
        variants: [
          { weight: 480, unit: 'g', displayWeight: '480g', mrp: 210, sellingPercentage: 82, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 450, sellingPercentage: 84, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 995, sellingPercentage: 86, isActive: true },
          { weight: 7000, unit: 'g', displayWeight: '7kg', mrp: 2150, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Persian Adult Cat Food',
        description: 'Specially designed for Persian cats. Supports skin and coat health.',
        category_id: catFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Royal+Canin+Persian'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 550, sellingPercentage: 85, isActive: true },
          { weight: 2000, unit: 'g', displayWeight: '2kg', mrp: 2400, sellingPercentage: 87, isActive: true },
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 4500, sellingPercentage: 88, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 10500, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Meo Tuna Adult Cat Food',
        description: 'Delicious tuna flavor with complete nutrition for adult cats.',
        category_id: catFood._id,
        brand_id: getBrand('Meo'),
        images: ['https://placehold.co/400x400?text=Meo+Tuna'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 155, sellingPercentage: 80, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 390, sellingPercentage: 83, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 850, sellingPercentage: 85, isActive: true },
          { weight: 7000, unit: 'g', displayWeight: '7kg', mrp: 1850, sellingPercentage: 87, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Sheba Chicken Chunks in Gravy - Wet Cat Food',
        description: 'Premium wet cat food with tender chicken chunks in savory gravy.',
        category_id: catFood._id,
        brand_id: getBrand('Sheba'),
        images: ['https://placehold.co/400x400?text=Sheba+Wet'],
        hasVariants: true,
        variants: [
          { weight: 70, unit: 'g', displayWeight: '70g', mrp: 60, sellingPercentage: 80, isActive: true },
          { weight: 85, unit: 'g', displayWeight: '85g', mrp: 75, sellingPercentage: 82, isActive: true },
          { weight: 750, unit: 'g', displayWeight: '750g (Pack of 12)', mrp: 850, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Kit Cat Chicken & Salmon Kitten Food',
        description: 'Complete nutrition for kittens with DHA for brain development.',
        category_id: catFood._id,
        brand_id: getBrand('Kit Cat'),
        images: ['https://placehold.co/400x400?text=Kit+Cat+Kitten'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 280, sellingPercentage: 82, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 720, sellingPercentage: 84, isActive: true },
          { weight: 5000, unit: 'g', displayWeight: '5kg', mrp: 2750, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Kitten Food',
        description: 'Complete nutrition for kittens from 4-12 months. Supports immune system.',
        category_id: catFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Royal+Canin+Kitten'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 495, sellingPercentage: 85, isActive: true },
          { weight: 2000, unit: 'g', displayWeight: '2kg', mrp: 2200, sellingPercentage: 87, isActive: true },
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 4100, sellingPercentage: 88, isActive: true },
          { weight: 10000, unit: 'g', displayWeight: '10kg', mrp: 9500, sellingPercentage: 89, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Whiskas Chicken Cat Food - Dry',
        description: 'Real chicken flavor with essential vitamins. Crunchy kibble.',
        category_id: catFood._id,
        brand_id: getBrand('Whiskas'),
        images: ['https://placehold.co/400x400?text=Whiskas+Chicken'],
        hasVariants: true,
        variants: [
          { weight: 480, unit: 'g', displayWeight: '480g', mrp: 220, sellingPercentage: 82, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 475, sellingPercentage: 84, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1050, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Meo Persian Cat Food - Long Hair',
        description: 'Specially formulated for Persian cats. Reduces hairballs.',
        category_id: catFood._id,
        brand_id: getBrand('Meo'),
        images: ['https://placehold.co/400x400?text=Meo+Persian'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 185, sellingPercentage: 81, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 450, sellingPercentage: 83, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 995, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Royal Canin Hair & Skin Care Cat Food',
        description: 'Promotes healthy skin and shiny coat. With omega fatty acids.',
        category_id: catFood._id,
        brand_id: getBrand('Royal Canin'),
        images: ['https://placehold.co/400x400?text=Hair+Skin'],
        hasVariants: true,
        variants: [
          { weight: 2000, unit: 'g', displayWeight: '2kg', mrp: 2350, sellingPercentage: 87, isActive: true },
          { weight: 4000, unit: 'g', displayWeight: '4kg', mrp: 4400, sellingPercentage: 88, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...catFoodProducts);

    // ==================== MORE CAT FOOD PRODUCTS ====================
    const moreCatFoodProducts = [
      {
        name: 'Whiskas Salmon Cat Food - Dry',
        description: 'Real salmon with omega-3. Supports healthy coat.',
        category_id: catFood._id,
        brand_id: getBrand('Whiskas'),
        images: ['https://placehold.co/400x400?text=Whiskas+Salmon'],
        hasVariants: true,
        variants: [
          { weight: 480, unit: 'g', displayWeight: '480g', mrp: 230, sellingPercentage: 82, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 495, sellingPercentage: 84, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 1095, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Meo Kitten Food - Milk Flavour',
        description: 'Complete nutrition for growing kittens. Easy to digest.',
        category_id: catFood._id,
        brand_id: getBrand('Meo'),
        images: ['https://placehold.co/400x400?text=Meo+Kitten'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 175, sellingPercentage: 80, isActive: true },
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 425, sellingPercentage: 83, isActive: true },
          { weight: 3000, unit: 'g', displayWeight: '3kg', mrp: 950, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Kit Cat Salmon & Ocean Fish Food',
        description: 'Premium blend of salmon and ocean fish. High protein.',
        category_id: catFood._id,
        brand_id: getBrand('Kit Cat'),
        images: ['https://placehold.co/400x400?text=Kit+Cat+Fish'],
        hasVariants: true,
        variants: [
          { weight: 1200, unit: 'g', displayWeight: '1.2kg', mrp: 795, sellingPercentage: 84, isActive: true },
          { weight: 5000, unit: 'g', displayWeight: '5kg', mrp: 3050, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Sheba Tuna in Jelly - Wet Cat Food',
        description: 'Premium wet food with tender tuna chunks in savory jelly.',
        category_id: catFood._id,
        brand_id: getBrand('Sheba'),
        images: ['https://placehold.co/400x400?text=Sheba+Tuna'],
        hasVariants: true,
        variants: [
          { weight: 70, unit: 'g', displayWeight: '70g', mrp: 65, sellingPercentage: 80, isActive: true },
          { weight: 750, unit: 'g', displayWeight: '750g (Pack of 12)', mrp: 895, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...moreCatFoodProducts);

    // ==================== FISH FOOD PRODUCTS (with variants) ====================
    const fishFoodProducts = [
      {
        name: 'Tetra Goldfish Flakes',
        description: 'Complete nutrition for goldfish with vitamin C boost. Enhances color brilliance.',
        category_id: fishFood._id,
        brand_id: getBrand('Tetra'),
        images: ['https://placehold.co/400x400?text=Tetra+Goldfish'],
        hasVariants: true,
        variants: [
          { weight: 52, unit: 'g', displayWeight: '52g', mrp: 265, sellingPercentage: 80, isActive: true },
          { weight: 100, unit: 'g', displayWeight: '100g', mrp: 450, sellingPercentage: 82, isActive: true },
          { weight: 200, unit: 'g', displayWeight: '200g', mrp: 795, sellingPercentage: 84, isActive: true },
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 1750, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'API Tropical Flakes',
        description: 'Premium tropical fish food with optimal protein level. Enhances natural colors.',
        category_id: fishFood._id,
        brand_id: getBrand('API'),
        images: ['https://placehold.co/400x400?text=API+Tropical'],
        hasVariants: true,
        variants: [
          { weight: 62, unit: 'g', displayWeight: '62g', mrp: 285, sellingPercentage: 81, isActive: true },
          { weight: 156, unit: 'g', displayWeight: '156g', mrp: 595, sellingPercentage: 83, isActive: true },
          { weight: 312, unit: 'g', displayWeight: '312g', mrp: 1050, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Tetra Betta Pellets',
        description: 'Floating micro pellets for Betta fish. Rich in protein and color enhancers.',
        category_id: fishFood._id,
        brand_id: getBrand('Tetra'),
        images: ['https://placehold.co/400x400?text=Tetra+Betta'],
        hasVariants: true,
        variants: [
          { weight: 27, unit: 'g', displayWeight: '27g', mrp: 195, sellingPercentage: 80, isActive: true },
          { weight: 85, unit: 'g', displayWeight: '85g', mrp: 485, sellingPercentage: 82, isActive: true },
          { weight: 160, unit: 'g', displayWeight: '160g', mrp: 850, sellingPercentage: 84, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Taiyo Pond Sticks',
        description: 'Complete nutrition for pond fish. Floating sticks that dont cloud water.',
        category_id: fishFood._id,
        brand_id: getBrand('Taiyo'),
        images: ['https://placehold.co/400x400?text=Taiyo+Pond'],
        hasVariants: true,
        variants: [
          { weight: 50, unit: 'g', displayWeight: '50g', mrp: 150, sellingPercentage: 78, isActive: true },
          { weight: 200, unit: 'g', displayWeight: '200g', mrp: 450, sellingPercentage: 80, isActive: true },
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 995, sellingPercentage: 82, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 1750, sellingPercentage: 84, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'API Goldfish Pellets',
        description: 'Floating pellets for goldfish. Promotes natural colors.',
        category_id: fishFood._id,
        brand_id: getBrand('API'),
        images: ['https://placehold.co/400x400?text=API+Goldfish'],
        hasVariants: true,
        variants: [
          { weight: 119, unit: 'g', displayWeight: '119g', mrp: 395, sellingPercentage: 81, isActive: true },
          { weight: 248, unit: 'g', displayWeight: '248g', mrp: 695, sellingPercentage: 83, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Tetra Color Tropical Flakes',
        description: 'Color-enhancing formula with natural pigment enhancers.',
        category_id: fishFood._id,
        brand_id: getBrand('Tetra'),
        images: ['https://placehold.co/400x400?text=Color+Flakes'],
        hasVariants: true,
        variants: [
          { weight: 52, unit: 'g', displayWeight: '52g', mrp: 285, sellingPercentage: 80, isActive: true },
          { weight: 200, unit: 'g', displayWeight: '200g', mrp: 845, sellingPercentage: 84, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...fishFoodProducts);

    // ==================== MORE FISH FOOD PRODUCTS ====================
    const moreFishFoodProducts = [
      {
        name: 'API Bottom Feeder Pellets',
        description: 'Sinking pellets for bottom-feeding fish. High protein.',
        category_id: fishFood._id,
        brand_id: getBrand('API'),
        images: ['https://placehold.co/400x400?text=Bottom+Feeder'],
        hasVariants: true,
        variants: [
          { weight: 57, unit: 'g', displayWeight: '57g', mrp: 295, sellingPercentage: 81, isActive: true },
          { weight: 170, unit: 'g', displayWeight: '170g', mrp: 695, sellingPercentage: 83, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Tetra Cichlid Sticks',
        description: 'Floating sticks for all cichlids. High protein content.',
        category_id: fishFood._id,
        brand_id: getBrand('Tetra'),
        images: ['https://placehold.co/400x400?text=Cichlid+Sticks'],
        hasVariants: true,
        variants: [
          { weight: 80, unit: 'g', displayWeight: '80g', mrp: 395, sellingPercentage: 81, isActive: true },
          { weight: 160, unit: 'g', displayWeight: '160g', mrp: 695, sellingPercentage: 83, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Taiyo Guppy Food',
        description: 'Micro granules for guppies and small fish. Easy to digest.',
        category_id: fishFood._id,
        brand_id: getBrand('Taiyo'),
        images: ['https://placehold.co/400x400?text=Guppy+Food'],
        hasVariants: true,
        variants: [
          { weight: 20, unit: 'g', displayWeight: '20g', mrp: 95, sellingPercentage: 75, isActive: true },
          { weight: 50, unit: 'g', displayWeight: '50g', mrp: 185, sellingPercentage: 78, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...moreFishFoodProducts);

    // ==================== BIRD FOOD PRODUCTS (with variants) ====================
    const birdFoodProducts = [
      {
        name: 'Vitapol Premium Food for Budgies',
        description: 'Complete nutrition with vitamins and minerals for budgies and parakeets.',
        category_id: birdFood._id,
        brand_id: getBrand('Vitapol'),
        images: ['https://placehold.co/400x400?text=Vitapol+Budgie'],
        hasVariants: true,
        variants: [
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 180, sellingPercentage: 78, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 320, sellingPercentage: 80, isActive: true },
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 750, sellingPercentage: 82, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Taiyo Parrot Food Mix',
        description: 'Premium seed mix for parrots with nuts and dried fruits.',
        category_id: birdFood._id,
        brand_id: getBrand('Taiyo'),
        images: ['https://placehold.co/400x400?text=Taiyo+Parrot'],
        hasVariants: true,
        variants: [
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 385, sellingPercentage: 80, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 695, sellingPercentage: 82, isActive: true },
          { weight: 2000, unit: 'g', displayWeight: '2kg', mrp: 1250, sellingPercentage: 84, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Cockatoo Finch & Canary Food',
        description: 'Specially formulated seed mix for finches and canaries with egg food.',
        category_id: birdFood._id,
        brand_id: getBrand('Cockatoo'),
        images: ['https://placehold.co/400x400?text=Cockatoo+Finch'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 165, sellingPercentage: 78, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 365, sellingPercentage: 80, isActive: true },
          { weight: 5000, unit: 'g', displayWeight: '5kg', mrp: 1650, sellingPercentage: 82, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Vitapol Economic Food for Parakeets',
        description: 'Value pack seed mix for parakeets. Complete nutrition.',
        category_id: birdFood._id,
        brand_id: getBrand('Vitapol'),
        images: ['https://placehold.co/400x400?text=Vitapol+Parakeet'],
        hasVariants: true,
        variants: [
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 295, sellingPercentage: 78, isActive: true },
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 695, sellingPercentage: 80, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Taiyo Cockatiel Food Mix',
        description: 'Premium seed blend for cockatiels with millet and sunflower.',
        category_id: birdFood._id,
        brand_id: getBrand('Taiyo'),
        images: ['https://placehold.co/400x400?text=Cockatiel+Mix'],
        hasVariants: true,
        variants: [
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 295, sellingPercentage: 79, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 525, sellingPercentage: 81, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...birdFoodProducts);

    // ==================== SMALL PET FOOD PRODUCTS (with variants) ====================
    const smallPetFoodProducts = [
      {
        name: 'Oxbow Essentials Adult Hamster Food',
        description: 'Complete nutrition for adult hamsters with timothy hay and essential nutrients.',
        category_id: hamsterFood._id,
        brand_id: getBrand('Oxbow'),
        images: ['https://placehold.co/400x400?text=Oxbow+Hamster'],
        hasVariants: true,
        variants: [
          { weight: 400, unit: 'g', displayWeight: '400g', mrp: 495, sellingPercentage: 82, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 1095, sellingPercentage: 84, isActive: true },
          { weight: 2500, unit: 'g', displayWeight: '2.5kg', mrp: 2450, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Versele-Laga Complete Rabbit Food',
        description: 'All-in-one pellets for rabbits with long fiber and vegetables.',
        category_id: rabbitFood._id,
        brand_id: getBrand('Versele-Laga'),
        images: ['https://placehold.co/400x400?text=Versele+Rabbit'],
        hasVariants: true,
        variants: [
          { weight: 500, unit: 'g', displayWeight: '500g', mrp: 425, sellingPercentage: 81, isActive: true },
          { weight: 1750, unit: 'g', displayWeight: '1.75kg', mrp: 1295, sellingPercentage: 83, isActive: true },
          { weight: 8000, unit: 'g', displayWeight: '8kg', mrp: 5450, sellingPercentage: 85, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Oxbow Essentials Guinea Pig Food',
        description: 'Complete nutrition with vitamin C for guinea pigs. Timothy hay based.',
        category_id: guineaPigFood._id,
        brand_id: getBrand('Oxbow'),
        images: ['https://placehold.co/400x400?text=Oxbow+Guinea'],
        hasVariants: true,
        variants: [
          { weight: 450, unit: 'g', displayWeight: '450g', mrp: 525, sellingPercentage: 82, isActive: true },
          { weight: 2250, unit: 'g', displayWeight: '2.25kg', mrp: 2295, sellingPercentage: 84, isActive: true },
          { weight: 4500, unit: 'g', displayWeight: '4.5kg', mrp: 4150, sellingPercentage: 86, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Kaytee Forti-Diet Pro Health Hamster Food',
        description: 'Fortified gourmet food for hamsters and gerbils with probiotics.',
        category_id: hamsterFood._id,
        brand_id: getBrand('Kaytee'),
        images: ['https://placehold.co/400x400?text=Kaytee+Hamster'],
        hasVariants: true,
        variants: [
          { weight: 350, unit: 'g', displayWeight: '350g', mrp: 385, sellingPercentage: 80, isActive: true },
          { weight: 1000, unit: 'g', displayWeight: '1kg', mrp: 995, sellingPercentage: 82, isActive: true },
        ],
        isPrime: false,
        isActive: true,
      },
    ];
    products.push(...smallPetFoodProducts);

    // ==================== DOG TOYS ====================
    const dogToyProducts = [
      { name: 'Kong Classic Dog Toy - Red', description: 'Durable rubber toy for chewing and fetch. Can be stuffed with treats.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Kong+Classic'], weight: 150, mrp: 750, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Kong Puppy Teething Toy - Pink', description: 'Soft rubber for puppy teeth and gums. Helps with teething pain.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Kong+Puppy'], weight: 120, mrp: 650, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Trixie Dog Activity Snack Ball', description: 'Interactive treat dispensing toy. Adjustable difficulty level.', category_id: dogToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Trixie+Ball'], weight: 200, mrp: 450, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Petmate Rope Tug Toy', description: 'Heavy duty rope toy for tug games. Helps clean teeth.', category_id: dogToys._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Rope+Toy'], weight: 180, mrp: 295, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Kong Squeaker Tennis Ball - 3 Pack', description: 'Tennis balls with squeakers. Non-abrasive felt.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Tennis+Balls'], weight: 180, mrp: 495, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Trixie Plush Mouse Dog Toy', description: 'Soft plush toy with squeaker. Great for gentle play.', category_id: dogToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Plush+Mouse'], weight: 80, mrp: 225, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Kong Flyer Rubber Frisbee', description: 'Soft rubber frisbee. Gentle on teeth and gums.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Frisbee'], weight: 150, mrp: 595, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Chew Bone - Bacon Flavor', description: 'Durable nylon chew bone with bacon flavor. Long-lasting.', category_id: dogToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Chew+Bone'], weight: 120, mrp: 325, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Kong Extreme Dog Toy - Black', description: 'Ultra-durable for power chewers. Strongest Kong formula.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Kong+Extreme'], weight: 165, mrp: 895, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Trixie Plush Rabbit', description: 'Soft plush rabbit with squeaker. Machine washable.', category_id: dogToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Plush+Rabbit'], weight: 110, mrp: 345, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Pawzone Interactive Puzzle Toy', description: 'Mental stimulation puzzle. Hide treats inside.', category_id: dogToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Puzzle+Toy'], weight: 280, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Kong Dental Stick', description: 'Dental cleaning stick. Cleans teeth and massages gums.', category_id: dogToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Dental+Stick'], weight: 140, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...dogToyProducts);

    // ==================== DOG ACCESSORIES ====================
    const dogAccessoryProducts = [
      { name: 'Flexi Retractable Dog Leash - 5m', description: 'Durable retractable leash for dogs up to 25kg. One-button braking.', category_id: dogAccessories._id, brand_id: getBrand('Flexi'), images: ['https://placehold.co/400x400?text=Flexi+Leash'], weight: 280, mrp: 1495, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Trixie Adjustable Dog Collar - Medium', description: 'Comfortable padded collar. Adjustable from 35-55cm.', category_id: dogAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Dog+Collar'], weight: 85, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Pawzone Dog Harness - No Pull', description: 'No-pull design harness for training. Breathable mesh.', category_id: dogAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Dog+Harness'], weight: 190, mrp: 695, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Petmate Ultra Vari Kennel - Medium', description: 'IATA approved travel carrier. Well-ventilated design.', category_id: dogAccessories._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Dog+Carrier'], weight: 3500, mrp: 4995, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Stainless Steel Dog Bowl - 1.8L', description: 'Non-slip stainless steel bowl. Dishwasher safe.', category_id: dogAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Dog+Bowl'], weight: 350, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
      { name: 'Pawzone Dog Bed - Orthopedic Memory Foam', description: 'Orthopedic bed with memory foam. Machine washable cover.', category_id: dogAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Dog+Bed'], weight: 2800, mrp: 3995, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Flexi LED Lighting System for Leash', description: 'LED light attachment for evening walks. Long battery life.', category_id: dogAccessories._id, brand_id: getBrand('Flexi'), images: ['https://placehold.co/400x400?text=LED+Light'], weight: 45, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Dog Raincoat - Waterproof', description: 'Waterproof raincoat with reflective strips. Adjustable fit.', category_id: dogAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Raincoat'], weight: 180, mrp: 895, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Pawzone Dog Muzzle - Safety', description: 'Breathable safety muzzle. Adjustable straps.', category_id: dogAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Muzzle'], weight: 95, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Flexi Retractable Leash - 8m', description: 'Extra long leash for larger dogs. Heavy-duty cord.', category_id: dogAccessories._id, brand_id: getBrand('Flexi'), images: ['https://placehold.co/400x400?text=Long+Leash'], weight: 350, mrp: 1795, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Trixie Dog Seat Cover for Car', description: 'Waterproof car seat cover. Easy to install.', category_id: dogAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Car+Cover'], weight: 680, mrp: 1295, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Dog Water Bottle - Portable', description: 'Leak-proof portable water bottle. 500ml capacity.', category_id: dogAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Water+Bottle'], weight: 180, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...dogAccessoryProducts);

    // ==================== DOG GROOMING ====================
    const dogGroomingProducts = [
      { name: 'Trixie Dog Shampoo - Aloe Vera', description: 'Gentle shampoo with aloe vera. pH balanced for dogs.', category_id: dogGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Dog+Shampoo'], weight: 250, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Pawzone Self-Cleaning Slicker Brush', description: 'Self-cleaning brush with retractable bristles. Removes loose fur.', category_id: dogGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Slicker+Brush'], weight: 120, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Nail Clipper for Dogs', description: 'Professional grade nail clipper. Safety guard included.', category_id: dogGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Nail+Clipper'], weight: 90, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Pawzone Dog Toothbrush & Toothpaste Kit', description: 'Complete dental care kit. Enzymatic toothpaste.', category_id: dogGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Dental+Kit'], weight: 110, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
      { name: 'Trixie Dog Comb - Double Sided', description: 'Professional grooming comb. Fine and coarse teeth.', category_id: dogGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Dog+Comb'], weight: 75, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Pawzone Tick & Flea Shampoo', description: 'Anti-tick and flea shampoo with neem extract.', category_id: dogGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Tick+Shampoo'], weight: 200, mrp: 525, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Undercoat Rake', description: 'Removes dead undercoat. Reduces shedding.', category_id: dogGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Undercoat+Rake'], weight: 130, mrp: 595, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Pawzone Paw Butter - Moisturizing', description: 'Natural paw butter for dry cracked paws. 100g.', category_id: dogGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Paw+Butter'], weight: 100, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Trixie Dog Cologne - Fresh Scent', description: 'Long-lasting cologne for dogs. Alcohol-free.', category_id: dogGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Dog+Cologne'], weight: 150, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Pawzone Detangling Spray', description: 'Makes brushing easier. Conditions coat.', category_id: dogGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Detangling+Spray'], weight: 200, mrp: 545, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...dogGroomingProducts);

    // ==================== DOG HEALTH ====================
    const dogHealthProducts = [
      { name: 'Drools Hip & Joint Supplement', description: 'Glucosamine and chondroitin supplement. Supports joint health.', category_id: dogHealth._id, brand_id: getBrand('Drools'), images: ['https://placehold.co/400x400?text=Joint+Supplement'], weight: 150, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Multivitamin Tablets for Dogs', description: 'Complete multivitamin with minerals. 60 tablets.', category_id: dogHealth._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Multivitamin'], weight: 100, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Drools Probiotic Powder', description: 'Digestive health probiotic. Supports gut flora.', category_id: dogHealth._id, brand_id: getBrand('Drools'), images: ['https://placehold.co/400x400?text=Probiotic'], weight: 120, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Pawzone Omega-3 Fish Oil Supplement', description: 'Pure fish oil for healthy skin and coat. Liquid formula.', category_id: dogHealth._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Fish+Oil'], weight: 200, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Drools Calming Treats', description: 'Natural calming treats with chamomile. Reduces anxiety.', category_id: dogHealth._id, brand_id: getBrand('Drools'), images: ['https://placehold.co/400x400?text=Calming+Treats'], weight: 180, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Pawzone Calcium Bone Supplement', description: 'Essential calcium for strong bones and teeth.', category_id: dogHealth._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Calcium'], weight: 120, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
      { name: 'Drools Dental Care Sticks', description: 'Helps reduce tartar and plaque. Fresh breath formula.', category_id: dogHealth._id, brand_id: getBrand('Drools'), images: ['https://placehold.co/400x400?text=Dental+Sticks'], weight: 200, mrp: 545, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Pawzone Anti-Tick and Flea Collar', description: 'Long-lasting protection for 8 months. Waterproof.', category_id: dogHealth._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Flea+Collar'], weight: 50, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Drools Puppy Milk Replacer', description: 'Complete nutrition for orphaned puppies. Easy to digest.', category_id: dogHealth._id, brand_id: getBrand('Drools'), images: ['https://placehold.co/400x400?text=Milk+Replacer'], weight: 400, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Ear Cleaning Solution', description: 'Gentle ear cleaner. Prevents infections.', category_id: dogHealth._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Ear+Cleaner'], weight: 100, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
    ];
    products.push(...dogHealthProducts);

    // ==================== CAT TOYS ====================
    const catToyProducts = [
      { name: 'Trixie Cat Feather Wand', description: 'Interactive feather wand toy. Extendable handle.', category_id: catToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Feather+Wand'], weight: 65, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Kong Cat Toy - Kickeroo', description: 'Catnip filled kicker toy. Perfect for bunny kicks.', category_id: catToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Kickeroo'], weight: 95, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Rolling Ball Track', description: 'Interactive ball track toy. Multiple levels.', category_id: catToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Ball+Track'], weight: 450, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Pawzone Catnip Mice - 6 Pack', description: 'Colorful catnip filled mice. Assorted colors.', category_id: catToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Cat+Mice'], weight: 120, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Kong Cat Toy Laser Pointer', description: 'LED laser pointer for interactive play. Includes batteries.', category_id: catToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Laser'], weight: 45, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Trixie Cat Tunnel - Collapsible', description: 'Fun collapsible play tunnel. Multiple openings.', category_id: catToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cat+Tunnel'], weight: 280, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Cat Spring Toy - 10 Pack', description: 'Colorful plastic spring toys. Hours of fun.', category_id: catToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Springs'], weight: 50, mrp: 195, sellingPercentage: 75, isPrime: false, isActive: true },
      { name: 'Kong Cat Wobbler Treat Toy', description: 'Treat dispensing wobbler toy. Adjustable difficulty.', category_id: catToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Wobbler'], weight: 180, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Trixie Cat Teaser Wand', description: 'Feather teaser with elastic string. Interactive play.', category_id: catToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Teaser'], weight: 55, mrp: 325, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Kong Crinkle Ball', description: 'Crinkle sound ball with catnip. Lightweight.', category_id: catToys._id, brand_id: getBrand('Kong'), images: ['https://placehold.co/400x400?text=Crinkle+Ball'], weight: 35, mrp: 245, sellingPercentage: 77, isPrime: false, isActive: true },
      { name: 'Pawzone Feather Balls - 4 Pack', description: 'Colorful balls with feathers. Encourages natural hunting.', category_id: catToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Feather+Balls'], weight: 80, mrp: 345, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Trixie Cat Activity Board', description: 'Interactive puzzle board. Multiple activities.', category_id: catToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Activity+Board'], weight: 520, mrp: 1295, sellingPercentage: 85, isPrime: false, isActive: true },
    ];
    products.push(...catToyProducts);

    // ==================== CAT ACCESSORIES ====================
    const catAccessoryProducts = [
      { name: 'Trixie Cat Scratching Post - Large', description: 'Tall sisal scratching post. Stable base.', category_id: catAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Scratching+Post'], weight: 4500, mrp: 2495, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Pawzone Cat Litter Box with Hood', description: 'Hooded litter box. Reduces litter scatter and odor.', category_id: catAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Litter+Box'], weight: 1800, mrp: 1295, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Petmate Cat Carrier - Airline Approved', description: 'Sturdy airline approved carrier. Well-ventilated.', category_id: catAccessories._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Cat+Carrier'], weight: 1200, mrp: 2495, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Ceramic Cat Bowl Set', description: 'Set of 2 ceramic bowls. Microwave and dishwasher safe.', category_id: catAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cat+Bowls'], weight: 650, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Pawzone Cat Bed - Soft Plush', description: 'Cozy plush bed. Machine washable.', category_id: catAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Cat+Bed'], weight: 780, mrp: 895, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Trixie Cat Tree - 3 Level', description: 'Multi-level cat tree with platforms and hiding spots.', category_id: catAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cat+Tree'], weight: 15000, mrp: 8995, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Flexi Cat Collar - Breakaway Safety', description: 'Breakaway safety collar with bell. Adjustable.', category_id: catAccessories._id, brand_id: getBrand('Flexi'), images: ['https://placehold.co/400x400?text=Cat+Collar'], weight: 35, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Pawzone Automatic Water Fountain', description: 'Circulating water fountain. Encourages drinking.', category_id: catAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Water+Fountain'], weight: 950, mrp: 1795, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Cat Window Perch', description: 'Suction cup window perch. Supports up to 20kg.', category_id: catAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Window+Perch'], weight: 850, mrp: 1495, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Pawzone Self-Cleaning Litter Box', description: 'Automatic self-cleaning litter box. App controlled.', category_id: catAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Auto+Litter'], weight: 5800, mrp: 12995, sellingPercentage: 88, isPrime: false, isActive: true },
      { name: 'Trixie Cat Feeding Mat', description: 'Silicone feeding mat. Easy to clean.', category_id: catAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Feeding+Mat'], weight: 180, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Flexi Cat Leash & Harness Set', description: 'Complete leash and harness set for cats. Escape-proof.', category_id: catAccessories._id, brand_id: getBrand('Flexi'), images: ['https://placehold.co/400x400?text=Cat+Leash'], weight: 120, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
    ];
    products.push(...catAccessoryProducts);

    // ==================== CAT LITTER ====================
    const catLitterProducts = [
      { name: 'Kit Cat Clumping Cat Litter - Lavender', description: 'Premium clumping litter with lavender scent. Low dust.', category_id: catLitter._id, brand_id: getBrand('Kit Cat'), images: ['https://placehold.co/400x400?text=Litter+Lavender'], weight: 10000, mrp: 895, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Kit Cat Clumping Cat Litter - Charcoal', description: 'Activated charcoal litter. Superior odor control.', category_id: catLitter._id, brand_id: getBrand('Kit Cat'), images: ['https://placehold.co/400x400?text=Litter+Charcoal'], weight: 10000, mrp: 995, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Meo Bentonite Cat Litter - Unscented', description: 'Natural bentonite clay litter. 99% dust free.', category_id: catLitter._id, brand_id: getBrand('Meo'), images: ['https://placehold.co/400x400?text=Bentonite+Litter'], weight: 5000, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Kit Cat Silica Gel Litter - Fresh Scent', description: 'Crystal silica gel litter. Absorbs moisture instantly.', category_id: catLitter._id, brand_id: getBrand('Kit Cat'), images: ['https://placehold.co/400x400?text=Silica+Litter'], weight: 3800, mrp: 795, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Meo Cat Litter - Lemon Scented', description: 'Clumping litter with lemon fragrance. Easy scooping.', category_id: catLitter._id, brand_id: getBrand('Meo'), images: ['https://placehold.co/400x400?text=Lemon+Litter'], weight: 10000, mrp: 795, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...catLitterProducts);

    // ==================== CAT GROOMING ====================
    const catGroomingProducts = [
      { name: 'Trixie Cat Shampoo - Gentle Formula', description: 'Mild shampoo for cats. Tear-free formula.', category_id: catGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cat+Shampoo'], weight: 200, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Pawzone Cat Grooming Glove', description: 'Gentle grooming glove. Removes loose fur.', category_id: catGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Grooming+Glove'], weight: 85, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Trixie Cat Nail Clipper', description: 'Precision nail clipper. Safety guard included.', category_id: catGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cat+Clipper'], weight: 65, mrp: 345, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Pawzone Hairball Control Paste', description: 'Natural hairball remedy. Malt flavor cats love.', category_id: catGrooming._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Hairball+Paste'], weight: 100, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Deshedding Brush', description: 'Professional deshedding tool. Reduces shedding by 90%.', category_id: catGrooming._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Deshedding+Brush'], weight: 110, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
    ];
    products.push(...catGroomingProducts);

    // ==================== AQUARIUM TANKS ====================
    const aquariumTankProducts = [
      { name: 'Aqueon Glass Aquarium - 10 Gallon', description: 'Crystal clear glass aquarium. Dimensions: 20x10x12 inches.', category_id: aquariumTanks._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=10+Gallon'], weight: 4800, mrp: 2495, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Fluval Flex Aquarium Kit - 15 Gallon', description: 'All-in-one kit with LED and filtration. Modern curved design.', category_id: aquariumTanks._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Fluval+Flex'], weight: 12000, mrp: 12995, sellingPercentage: 88, isPrime: false, isActive: true },
      { name: 'Marina LED Aquarium Kit - 5 Gallon', description: 'Complete starter kit. Includes filter and LED lighting.', category_id: aquariumTanks._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=5+Gallon'], weight: 2800, mrp: 1995, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Aqueon Tank - 20 Gallon Long', description: 'Standard 20 gallon long tank. Dimensions: 30x12x12 inches.', category_id: aquariumTanks._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=20+Gallon'], weight: 9000, mrp: 3995, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Fluval Edge Aquarium - 6 Gallon', description: 'Unique 6-sided design. LED lighting included.', category_id: aquariumTanks._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Fluval+Edge'], weight: 8500, mrp: 8995, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Marina Betta Kit - 2.5 Gallon', description: 'Perfect for bettas. Includes LED and filter.', category_id: aquariumTanks._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Betta+Kit'], weight: 1500, mrp: 1295, sellingPercentage: 83, isPrime: false, isActive: true },
    ];
    products.push(...aquariumTankProducts);

    // ==================== AQUARIUM DECOR ====================
    const aquariumDecorProducts = [
      { name: 'Marina Natural Aquarium Gravel - Black', description: 'Natural polished gravel. 2kg bag.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Black+Gravel'], weight: 2000, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Fluval Plant and Shrimp Substrate', description: 'Nutrient-rich substrate for planted tanks. 4kg bag.', category_id: aquariumDecor._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Substrate'], weight: 4000, mrp: 1295, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Marina Resin Ornament - Sunken Ship', description: 'Detailed resin decoration. Safe for all fish.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Sunken+Ship'], weight: 380, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Aqueon Artificial Plant - Large', description: 'Realistic plastic plant. Easy to clean.', category_id: aquariumDecor._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=Fake+Plant'], weight: 120, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Marina Naturals Driftwood - Medium', description: 'Natural looking resin driftwood. No discoloration.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Driftwood'], weight: 450, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Fluval Decorative Rock Cave', description: 'Natural looking hiding cave. Multiple entry points.', category_id: aquariumDecor._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Rock+Cave'], weight: 680, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Marina Buddha Ornament - Small', description: 'Zen Buddha decoration. Creates focal point.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Buddha'], weight: 290, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
      { name: 'Aqueon Colorful Gravel Mix - Rainbow', description: 'Vibrant colored gravel mix. Safe for all fish.', category_id: aquariumDecor._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=Rainbow+Gravel'], weight: 2000, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Marina Naturals Silk Plant - Medium', description: 'Soft silk plant. Wont harm fish fins.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Silk+Plant'], weight: 95, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Fluval Volcanic Rock', description: 'Natural volcanic lava rock. Provides hiding spots.', category_id: aquariumDecor._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Volcanic+Rock'], weight: 850, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Aqueon Aquarium Background - Blue Ocean', description: 'Peel and stick background. 48 inch.', category_id: aquariumDecor._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=Background'], weight: 120, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
      { name: 'Marina Air Stone - Round', description: 'Creates fine bubble stream. Improves oxygenation.', category_id: aquariumDecor._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Air+Stone'], weight: 45, mrp: 195, sellingPercentage: 75, isPrime: false, isActive: true },
    ];
    products.push(...aquariumDecorProducts);

    // ==================== AQUARIUM LIGHTS ====================
    const aquariumLightProducts = [
      { name: 'Fluval Aquasky LED 2.0 - 24-34 inch', description: 'Smart LED with app control. Full spectrum lighting.', category_id: aquariumLights._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Aquasky+LED'], weight: 850, mrp: 8995, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Marina LED Light - 14-16 inch', description: 'Bright white LED. Low energy consumption.', category_id: aquariumLights._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Marina+LED'], weight: 280, mrp: 995, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Aqueon Modular LED Lamp - 18 inch', description: 'Sleek modular design. Adjustable mounting.', category_id: aquariumLights._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=Modular+LED'], weight: 450, mrp: 1795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Fluval Plant Spectrum LED - 24-34 inch', description: 'Optimized for plant growth. 7000K daylight spectrum.', category_id: aquariumLights._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Plant+LED'], weight: 680, mrp: 4995, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Marina Aqua Glo T8 Fluorescent Bulb - 18W', description: 'Enhances fish colors. 18-inch bulb.', category_id: aquariumLights._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=T8+Bulb'], weight: 120, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...aquariumLightProducts);

    // ==================== AQUARIUM FILTERS ====================
    const aquariumFilterProducts = [
      { name: 'Fluval C4 Power Filter', description: 'Multi-stage filtration for up to 70 gallon tanks.', category_id: aquariumFilters._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Fluval+C4'], weight: 1800, mrp: 4995, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Marina Slim Filter S10', description: 'Compact internal filter. For tanks up to 10 gallons.', category_id: aquariumFilters._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Slim+Filter'], weight: 280, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Aqueon QuietFlow 10 Power Filter', description: 'Quiet operation. For 10 gallon tanks.', category_id: aquariumFilters._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=QuietFlow'], weight: 580, mrp: 1295, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Fluval 407 External Canister Filter', description: 'High performance canister. For tanks up to 100 gallons.', category_id: aquariumFilters._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Canister+407'], weight: 5200, mrp: 14995, sellingPercentage: 88, isPrime: false, isActive: true },
      { name: 'Marina i160 Internal Filter', description: 'Complete internal filtration. For 30 gallon tanks.', category_id: aquariumFilters._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=i160+Filter'], weight: 520, mrp: 1595, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Aqueon QuietFlow 30 Filter', description: 'Powerful yet quiet. For up to 30 gallon tanks.', category_id: aquariumFilters._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=QuietFlow+30'], weight: 890, mrp: 1995, sellingPercentage: 85, isPrime: false, isActive: true },
    ];
    products.push(...aquariumFilterProducts);

    // ==================== AQUARIUM ACCESSORIES ====================
    const aquariumAccessoryProducts = [
      { name: 'Marina Aquarium Heater - 50W', description: 'Submersible heater for 10-15 gallon tanks. Adjustable temperature.', category_id: aquariumAccessories._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Heater+50W'], weight: 240, mrp: 795, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'API Freshwater Master Test Kit', description: 'Complete water testing kit. Tests pH, ammonia, nitrite, nitrate.', category_id: aquariumAccessories._id, brand_id: getBrand('API'), images: ['https://placehold.co/400x400?text=Test+Kit'], weight: 380, mrp: 1895, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Marina Aquarium Air Pump - 25', description: 'Quiet air pump for tanks up to 25 gallons.', category_id: aquariumAccessories._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Air+Pump'], weight: 320, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Fluval Edge Pre-Filter Sponge', description: 'Replacement pre-filter sponge. Pack of 2.', category_id: aquariumAccessories._id, brand_id: getBrand('Fluval'), images: ['https://placehold.co/400x400?text=Sponge'], weight: 45, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Marina Floating Thermometer', description: 'Easy to read floating thermometer. Both C and F scales.', category_id: aquariumAccessories._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Thermometer'], weight: 25, mrp: 195, sellingPercentage: 75, isPrime: false, isActive: true },
      { name: 'Aqueon Siphon Water Changer', description: 'Easy water change system. No bucket needed.', category_id: aquariumAccessories._id, brand_id: getBrand('Aqueon'), images: ['https://placehold.co/400x400?text=Siphon'], weight: 680, mrp: 1295, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'API Stress Coat Water Conditioner', description: 'Makes tap water safe. Removes chlorine and chloramines. 473ml.', category_id: aquariumAccessories._id, brand_id: getBrand('API'), images: ['https://placehold.co/400x400?text=Stress+Coat'], weight: 500, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Marina Algae Magnet Cleaner - Small', description: 'Magnetic glass cleaner. For glass up to 6mm thick.', category_id: aquariumAccessories._id, brand_id: getBrand('Marina'), images: ['https://placehold.co/400x400?text=Algae+Magnet'], weight: 180, mrp: 495, sellingPercentage: 81, isPrime: false, isActive: true },
    ];
    products.push(...aquariumAccessoryProducts);

    // ==================== BIRD CAGES ====================
    const birdCageProducts = [
      { name: 'Trixie Budgie Cage - 2 Budgies', description: 'Spacious cage for 2 budgies. Dimensions: 40x40x58cm.', category_id: birdCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Budgie+Cage'], weight: 4500, mrp: 2995, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Parrot Cage - Large', description: 'Large parrot cage with play top. Multiple doors.', category_id: birdCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Parrot+Cage'], weight: 18000, mrp: 12995, sellingPercentage: 88, isPrime: false, isActive: true },
      { name: 'Petmate Canary/Finch Cage', description: 'Perfect for small birds. Includes perches and feeders.', category_id: birdCages._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Canary+Cage'], weight: 2800, mrp: 1995, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Trixie Cockatiel Cage with Stand', description: 'Complete cage with rolling stand. Easy to move.', category_id: birdCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cockatiel+Cage'], weight: 12000, mrp: 7995, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Petmate Travel Bird Carrier', description: 'Portable carrier for vet visits. Includes perch.', category_id: birdCages._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Bird+Carrier'], weight: 850, mrp: 1295, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Trixie Lovebird Cage - Pair', description: 'Ideal for lovebird pairs. Horizontal bars for climbing.', category_id: birdCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Lovebird+Cage'], weight: 5200, mrp: 3495, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Petmate Breeding Cage', description: 'Breeding cage with divider. Multiple compartments.', category_id: birdCages._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Breeding+Cage'], weight: 6800, mrp: 4995, sellingPercentage: 86, isPrime: false, isActive: true },
    ];
    products.push(...birdCageProducts);

    // ==================== BIRD TOYS ====================
    const birdToyProducts = [
      { name: 'Trixie Bird Swing with Bell', description: 'Wooden swing with bell. Fun activity for birds.', category_id: birdToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Bird+Swing'], weight: 95, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Vitapol Mineral Block for Birds', description: 'Essential minerals and calcium. Keeps beak trimmed.', category_id: birdToys._id, brand_id: getBrand('Vitapol'), images: ['https://placehold.co/400x400?text=Mineral+Block'], weight: 180, mrp: 195, sellingPercentage: 75, isPrime: false, isActive: true },
      { name: 'Trixie Bird Ladder - Wooden', description: 'Natural wood ladder. Great for climbing.', category_id: birdToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Bird+Ladder'], weight: 120, mrp: 345, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Pawzone Cuttlebone for Birds - 3 Pack', description: 'Natural cuttlebone. Source of calcium.', category_id: birdToys._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Cuttlebone'], weight: 150, mrp: 195, sellingPercentage: 75, isPrime: false, isActive: true },
      { name: 'Trixie Bird Mirror with Beads', description: 'Colorful mirror toy with beads. Stimulates play.', category_id: birdToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Bird+Mirror'], weight: 75, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Vitapol Sanded Perch Cover', description: 'Natural nail trimming perch. Fits standard perches.', category_id: birdToys._id, brand_id: getBrand('Vitapol'), images: ['https://placehold.co/400x400?text=Perch+Cover'], weight: 65, mrp: 225, sellingPercentage: 77, isPrime: false, isActive: true },
    ];
    products.push(...birdToyProducts);

    // ==================== BIRD ACCESSORIES ====================
    const birdAccessoryProducts = [
      { name: 'Trixie Plastic Bird Bath', description: 'Clip-on bird bath. Easy to clean.', category_id: birdAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Bird+Bath'], weight: 180, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Pawzone Bird Feeder - Automatic', description: 'Automatic seed dispenser. No spill design.', category_id: birdAccessories._id, brand_id: getBrand('Pawzone'), images: ['https://placehold.co/400x400?text=Bird+Feeder'], weight: 220, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Water Dispenser for Birds', description: 'Gravity-fed water dispenser. 200ml capacity.', category_id: birdAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Water+Dispenser'], weight: 150, mrp: 345, sellingPercentage: 79, isPrime: false, isActive: true },
      { name: 'Vitapol Natural Wooden Perch', description: 'Natural wood perch. Varying diameters for foot health.', category_id: birdAccessories._id, brand_id: getBrand('Vitapol'), images: ['https://placehold.co/400x400?text=Wood+Perch'], weight: 95, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Trixie Cage Cover - Medium', description: 'Breathable cage cover. Helps birds sleep better.', category_id: birdAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Cage+Cover'], weight: 240, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
    ];
    products.push(...birdAccessoryProducts);

    // ==================== SMALL PET CAGES ====================
    const smallPetCageProducts = [
      { name: 'Kaytee My First Home Hamster Cage', description: 'Complete starter cage for hamsters. Includes wheel and bottle.', category_id: smallPetCages._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Hamster+Cage'], weight: 2800, mrp: 2495, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Wooden Rabbit Hutch', description: 'Spacious outdoor hutch for rabbits. Weatherproof.', category_id: smallPetCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Rabbit+Hutch'], weight: 15000, mrp: 8995, sellingPercentage: 87, isPrime: false, isActive: true },
      { name: 'Kaytee Guinea Pig Home', description: 'Large cage perfect for guinea pigs. Easy access doors.', category_id: smallPetCages._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Guinea+Pig+Home'], weight: 3500, mrp: 3495, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Petmate Hamster Habitat - Deluxe', description: 'Multi-level hamster habitat with tubes and accessories.', category_id: smallPetCages._id, brand_id: getBrand('Petmate'), images: ['https://placehold.co/400x400?text=Hamster+Habitat'], weight: 4200, mrp: 3995, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Trixie Indoor Rabbit Cage', description: 'Indoor cage with pull-out tray. Easy to clean.', category_id: smallPetCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Indoor+Rabbit'], weight: 6500, mrp: 4995, sellingPercentage: 86, isPrime: false, isActive: true },
      { name: 'Kaytee CritterTrail Two Level Habitat', description: 'Two-level habitat with connecting tubes. Fun for small pets.', category_id: smallPetCages._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=CritterTrail'], weight: 3200, mrp: 2995, sellingPercentage: 85, isPrime: false, isActive: true },
      { name: 'Trixie Gerbil Cage with Acrylic Tank', description: 'Deep acrylic tank perfect for burrowing. Wire top.', category_id: smallPetCages._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Gerbil+Cage'], weight: 4800, mrp: 3795, sellingPercentage: 86, isPrime: false, isActive: true },
    ];
    products.push(...smallPetCageProducts);

    // ==================== SMALL PET TOYS ====================
    const smallPetToyProducts = [
      { name: 'Kaytee Silent Spinner Exercise Wheel', description: 'Quiet exercise wheel for hamsters. 6.5 inch diameter.', category_id: smallPetToys._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Silent+Wheel'], weight: 280, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Wooden Chew Toys Set', description: 'Natural wood chew toys. Set of 3 different shapes.', category_id: smallPetToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Chew+Toys'], weight: 180, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Oxbow Enriched Life Play Tunnel', description: 'Collapsible play tunnel for rabbits and guinea pigs.', category_id: smallPetToys._id, brand_id: getBrand('Oxbow'), images: ['https://placehold.co/400x400?text=Play+Tunnel'], weight: 320, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Kaytee Hamster Ball - Medium', description: 'Exercise ball for supervised playtime. 7 inch.', category_id: smallPetToys._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Hamster+Ball'], weight: 180, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Trixie Grass House for Rabbits', description: 'Natural grass hideout. Great for chewing.', category_id: smallPetToys._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Grass+House'], weight: 280, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Oxbow Timothy Club - Small', description: 'Edible hideout made from timothy hay.', category_id: smallPetToys._id, brand_id: getBrand('Oxbow'), images: ['https://placehold.co/400x400?text=Timothy+Club'], weight: 120, mrp: 495, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...smallPetToyProducts);

    // ==================== SMALL PET ACCESSORIES ====================
    const smallPetAccessoryProducts = [
      { name: 'Kaytee Water Bottle - Medium', description: 'Leak-proof water bottle. 16 oz capacity.', category_id: smallPetAccessories._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Water+Bottle'], weight: 150, mrp: 395, sellingPercentage: 80, isPrime: false, isActive: true },
      { name: 'Trixie Ceramic Food Bowl - Small', description: 'Heavy ceramic bowl. Tip-proof design.', category_id: smallPetAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Ceramic+Bowl'], weight: 280, mrp: 295, sellingPercentage: 78, isPrime: false, isActive: true },
      { name: 'Oxbow Hay Feeder - Rack Style', description: 'Keeps hay fresh and accessible. Reduces waste.', category_id: smallPetAccessories._id, brand_id: getBrand('Oxbow'), images: ['https://placehold.co/400x400?text=Hay+Feeder'], weight: 180, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
      { name: 'Kaytee Small Pet Carrier', description: 'Portable carrier for vet visits. Ventilated design.', category_id: smallPetAccessories._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Pet+Carrier'], weight: 680, mrp: 895, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Trixie Small Pet Bed - Soft', description: 'Cozy fleece bed. Machine washable.', category_id: smallPetAccessories._id, brand_id: getBrand('Trixie'), images: ['https://placehold.co/400x400?text=Pet+Bed'], weight: 240, mrp: 695, sellingPercentage: 83, isPrime: false, isActive: true },
      { name: 'Oxbow Small Pet Grooming Kit', description: 'Complete grooming kit. Includes brush, comb, and nail clipper.', category_id: smallPetAccessories._id, brand_id: getBrand('Oxbow'), images: ['https://placehold.co/400x400?text=Grooming+Kit'], weight: 180, mrp: 795, sellingPercentage: 84, isPrime: false, isActive: true },
      { name: 'Kaytee Aspen Bedding - 1.13 Cu Ft', description: 'Natural aspen shavings. Dust-free and absorbent.', category_id: smallPetAccessories._id, brand_id: getBrand('Kaytee'), images: ['https://placehold.co/400x400?text=Bedding'], weight: 1200, mrp: 595, sellingPercentage: 82, isPrime: false, isActive: true },
    ];
    products.push(...smallPetAccessoryProducts);

    // ==================== INSERT ALL PRODUCTS ====================
    console.log(`\n💾 Inserting ${products.length} products into database...`);
    await Product.insertMany(products);
    console.log(`✅ Successfully created ${products.length} products`);

    // ==================== SUMMARY ====================
    console.log('\n========================================');
    console.log('✨ SEED COMPLETED SUCCESSFULLY ✨');
    console.log('========================================\n');
    console.log(`📦 Brands Created: ${brands.length}`);
    console.log(`📁 Categories Created: 30 (5 parent + 25 subcategories)`);
    console.log(`🛍️  Products Created: ${products.length}`);
    console.log('\n📊 Product Breakdown:');
    console.log(`   - Dog Food: ${dogFoodProducts.length} products`);
    console.log(`   - Dog Toys: ${dogToyProducts.length} products`);
    console.log(`   - Dog Accessories: ${dogAccessoryProducts.length} products`);
    console.log(`   - Dog Grooming: ${dogGroomingProducts.length} products`);
    console.log(`   - Dog Health: ${dogHealthProducts.length} products`);
    console.log(`   - Cat Food: ${catFoodProducts.length} products`);
    console.log(`   - Cat Toys: ${catToyProducts.length} products`);
    console.log(`   - Cat Accessories: ${catAccessoryProducts.length} products`);
    console.log(`   - Cat Litter: ${catLitterProducts.length} products`);
    console.log(`   - Cat Grooming: ${catGroomingProducts.length} products`);
    console.log(`   - Fish Food: ${fishFoodProducts.length} products`);
    console.log(`   - Aquarium Tanks: ${aquariumTankProducts.length} products`);
    console.log(`   - Aquarium Decor: ${aquariumDecorProducts.length} products`);
    console.log(`   - Aquarium Lights: ${aquariumLightProducts.length} products`);
    console.log(`   - Aquarium Filters: ${aquariumFilterProducts.length} products`);
    console.log(`   - Aquarium Accessories: ${aquariumAccessoryProducts.length} products`);
    console.log(`   - Bird Food: ${birdFoodProducts.length} products`);
    console.log(`   - Bird Cages: ${birdCageProducts.length} products`);
    console.log(`   - Bird Toys: ${birdToyProducts.length} products`);
    console.log(`   - Bird Accessories: ${birdAccessoryProducts.length} products`);
    console.log(`   - Small Pet Food: ${smallPetFoodProducts.length} products`);
    console.log(`   - Small Pet Cages: ${smallPetCageProducts.length} products`);
    console.log(`   - Small Pet Toys: ${smallPetToyProducts.length} products`);
    console.log(`   - Small Pet Accessories: ${smallPetAccessoryProducts.length} products`);
    console.log('\n🎯 All products marked as ACTIVE and AVAILABLE');
    console.log('🎁 Food products have multiple weight variants');
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedComprehensiveProducts();
