import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import Brand from './src/models/Brand';

dotenv.config();

async function seedAllProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  CLEARING EXISTING PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const deletedCount = await Product.deleteMany({});
    console.log(`✅ Deleted ${deletedCount.deletedCount} existing products\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏷️  FETCHING BRANDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all brands
    const brands = await Brand.find({ isActive: true });
    const brandMap: any = {};
    brands.forEach(brand => {
      brandMap[brand.name] = brand._id;
    });

    console.log(`Found ${brands.length} active brands\n`);

    // Default brand if specific brand not found
    const defaultBrand = brands[0]?._id;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐕 CREATING DOG PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dogProducts = [
      // DOG FOOD (6 products)
      {
        name: 'Pedigree Adult Dry Dog Food',
        description: 'Complete nutrition for adult dogs with chicken and vegetables',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Pedigree'] || defaultBrand,
        mrp: 1500,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Pedigree+Dog+Food'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1500, sellingPercentage: 85, isActive: true },
          { weight: 10, unit: 'kg', displayWeight: '10kg', mrp: 4500, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Maxi Adult Dog Food',
        description: 'Premium nutrition for large breed adult dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Royal Canin'] || defaultBrand,
        mrp: 3500,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Royal+Canin'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 3500, sellingPercentage: 90, isActive: true },
          { weight: 10, unit: 'kg', displayWeight: '10kg', mrp: 8000, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Drools Adult Chicken Dog Food',
        description: 'High protein chicken formula for adult dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Drools'] || defaultBrand,
        mrp: 1200,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Drools'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1200, sellingPercentage: 80, isActive: true },
          { weight: 12, unit: 'kg', displayWeight: '12kg', mrp: 4500, sellingPercentage: 80, isActive: true }
        ]
      },
      {
        name: 'Pedigree Puppy Dry Dog Food',
        description: 'Complete nutrition for growing puppies',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Pedigree'] || defaultBrand,
        mrp: 1400,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Pedigree+Puppy'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1400, sellingPercentage: 85, isActive: true },
          { weight: 10, unit: 'kg', displayWeight: '10kg', mrp: 4200, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Mini Puppy Food',
        description: 'Specially formulated for small breed puppies',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Royal Canin'] || defaultBrand,
        mrp: 2800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=RC+Puppy'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 2800, sellingPercentage: 90, isActive: true },
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 5200, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Drools Senior Dog Food',
        description: 'Nutritious food for senior dogs with joint support',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: brandMap['Drools'] || defaultBrand,
        mrp: 1300,
        sellingPercentage: 82,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Drools+Senior'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1300, sellingPercentage: 82, isActive: true },
          { weight: 12, unit: 'kg', displayWeight: '12kg', mrp: 5000, sellingPercentage: 82, isActive: true }
        ]
      },

      // DOG MEDICINE (5 products)
      {
        name: 'Himalaya Erina Coat Cleanser',
        description: 'Herbal coat cleanser for dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 350,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Himalaya+Erina'],
        isActive: true
      },
      {
        name: 'Himalaya Scavon Spray',
        description: 'Antiseptic wound healing spray for dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Scavon'],
        isActive: true
      },
      {
        name: 'Beaphar Worming Syrup',
        description: 'Deworming solution for puppies and dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Dewormer'],
        isActive: true
      },
      {
        name: 'Himalaya Digyton Tablets',
        description: 'Digestive supplement for dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Digyton'],
        isActive: true
      },
      {
        name: 'Bayer Droncit Dewormer',
        description: 'Effective tape worm treatment',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: brandMap['Bayer'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Droncit'],
        isActive: true
      },

      // DOG ACCESSORIES (6 products)
      {
        name: 'Trixie Nylon Dog Collar',
        description: 'Adjustable nylon collar for dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Dog+Collar'],
        isActive: true
      },
      {
        name: 'Flexi Retractable Dog Leash',
        description: 'Retractable leash with 5m cord',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Flexi'] || defaultBrand,
        mrp: 1200,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Flexi+Leash'],
        isActive: true
      },
      {
        name: 'Trixie Stainless Steel Dog Bowl',
        description: 'Durable feeding bowl',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 350,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Dog+Bowl'],
        isActive: true
      },
      {
        name: 'Petmate Dog Carrier Bag',
        description: 'Comfortable travel carrier for small dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Petmate'] || defaultBrand,
        mrp: 2500,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Carrier'],
        isActive: true
      },
      {
        name: 'Trixie Double Sided Grooming Brush',
        description: 'Professional grooming brush',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Brush'],
        isActive: true
      },
      {
        name: 'Pawzone Raincoat for Dogs',
        description: 'Waterproof raincoat',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: brandMap['Pawzone'] || defaultBrand,
        mrp: 650,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Raincoat'],
        isActive: true
      },

      // DOG TOYS (5 products)
      {
        name: 'Kong Classic Dog Toy',
        description: 'Durable rubber chew toy',
        mainCategory: 'Dog',
        subCategory: 'Dog Toys',
        brand_id: brandMap['Kong'] || defaultBrand,
        mrp: 850,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4F5E8/A8E6CF?text=Kong+Toy'],
        isActive: true
      },
      {
        name: 'Trixie Rope Tug Toy',
        description: 'Colorful rope for tug games',
        mainCategory: 'Dog',
        subCategory: 'Dog Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5E8/A8E6CF?text=Rope+Toy'],
        isActive: true
      },
      {
        name: 'Trixie Plush Squeaky Toy',
        description: 'Soft plush toy with squeaker',
        mainCategory: 'Dog',
        subCategory: 'Dog Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5E8/A8E6CF?text=Plush+Toy'],
        isActive: true
      },
      {
        name: 'Kong Frisbee for Dogs',
        description: 'Flying disc for outdoor play',
        mainCategory: 'Dog',
        subCategory: 'Dog Toys',
        brand_id: brandMap['Kong'] || defaultBrand,
        mrp: 650,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4F5E8/A8E6CF?text=Frisbee'],
        isActive: true
      },
      {
        name: 'Trixie Ball Launcher',
        description: 'Tennis ball launcher for dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5E8/A8E6CF?text=Launcher'],
        isActive: true
      },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐱 CREATING CAT PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const catProducts = [
      // CAT FOOD (6 products)
      {
        name: 'Whiskas Adult Dry Cat Food',
        description: 'Complete nutrition with ocean fish',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Whiskas'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Whiskas'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 450, sellingPercentage: 85, isActive: true },
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1200, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Persian Adult Cat Food',
        description: 'Specially designed for Persian cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Royal Canin'] || defaultBrand,
        mrp: 2800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=RC+Persian'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 2800, sellingPercentage: 90, isActive: true },
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 5200, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Me-O Adult Cat Food Tuna',
        description: 'Tuna flavor dry food for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Meo'] || brandMap['Me-O'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Me-O'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 380, sellingPercentage: 78, isActive: true },
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1050, sellingPercentage: 78, isActive: true }
        ]
      },
      {
        name: 'Whiskas Kitten Dry Food',
        description: 'Nutritious food for growing kittens',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Whiskas'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Whiskas+Kitten'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 420, sellingPercentage: 85, isActive: true },
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1150, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Mother & Babycat',
        description: 'For pregnant cats and kittens',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Royal Canin'] || defaultBrand,
        mrp: 1800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=RC+Babycat'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 1800, sellingPercentage: 90, isActive: true },
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 3400, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Me-O Seafood Platter Cat Food',
        description: 'Mixed seafood flavor',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: brandMap['Meo'] || brandMap['Me-O'] || defaultBrand,
        mrp: 400,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Me-O+Seafood'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 400, sellingPercentage: 78, isActive: true },
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1100, sellingPercentage: 78, isActive: true }
        ]
      },

      // CAT MEDICINE (5 products)
      {
        name: 'Himalaya Erina-EP Shampoo for Cats',
        description: 'Gentle shampoo for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Erina+Cat'],
        isActive: true
      },
      {
        name: 'Beaphar Cat Worming Paste',
        description: 'Deworming paste for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Dewormer'],
        isActive: true
      },
      {
        name: 'Himalaya Furball Control',
        description: 'Helps eliminate hairballs',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Furball'],
        isActive: true
      },
      {
        name: 'Droncit Cat Dewormer',
        description: 'Tapeworm treatment for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: brandMap['Bayer'] || defaultBrand,
        mrp: 350,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Droncit+Cat'],
        isActive: true
      },
      {
        name: 'Himalaya Liv.52 Pet Liquid',
        description: 'Liver tonic for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: brandMap['Himalaya'] || defaultBrand,
        mrp: 250,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Liv.52'],
        isActive: true
      },

      // CAT ACCESSORIES (5 products)
      {
        name: 'Trixie Cat Litter Box',
        description: 'Large covered litter box',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 1200,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Litter+Box'],
        isActive: true
      },
      {
        name: 'Trixie Cat Scratching Post',
        description: 'Sisal scratching post',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 1500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Scratching+Post'],
        isActive: true
      },
      {
        name: 'Petmate Cat Carrier',
        description: 'Travel carrier for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: brandMap['Petmate'] || defaultBrand,
        mrp: 2200,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Cat+Carrier'],
        isActive: true
      },
      {
        name: 'Trixie Cat Feeding Bowl Set',
        description: 'Ceramic bowl set for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Cat+Bowl'],
        isActive: true
      },
      {
        name: 'Trixie Cat Grooming Glove',
        description: 'Gentle grooming glove',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Grooming+Glove'],
        isActive: true
      },

      // CAT TOYS (5 products)
      {
        name: 'Trixie Feather Wand Cat Toy',
        description: 'Interactive feather wand',
        mainCategory: 'Cat',
        subCategory: 'Cat Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFE8D4/F39C12?text=Feather+Wand'],
        isActive: true
      },
      {
        name: 'Trixie Cat Ball Set',
        description: 'Set of 3 colorful balls',
        mainCategory: 'Cat',
        subCategory: 'Cat Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFE8D4/F39C12?text=Cat+Balls'],
        isActive: true
      },
      {
        name: 'Trixie Catnip Mouse Toy',
        description: 'Mouse toy with catnip',
        mainCategory: 'Cat',
        subCategory: 'Cat Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 180,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFE8D4/F39C12?text=Catnip+Mouse'],
        isActive: true
      },
      {
        name: 'Trixie Laser Pointer',
        description: 'Interactive laser toy',
        mainCategory: 'Cat',
        subCategory: 'Cat Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFE8D4/F39C12?text=Laser+Pointer'],
        isActive: true
      },
      {
        name: 'Trixie Cat Tunnel',
        description: 'Collapsible play tunnel',
        mainCategory: 'Cat',
        subCategory: 'Cat Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 650,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFE8D4/F39C12?text=Cat+Tunnel'],
        isActive: true
      },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐠 CREATING FISH PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const fishProducts = [
      // FISH FOOD (6 products)
      {
        name: 'Tetra Goldfish Flakes',
        description: 'Complete nutrition for goldfish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Tetra'] || brandMap['TetraMin'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Tetra+Goldfish'],
        isActive: true
      },
      {
        name: 'TetraMin Tropical Flakes',
        description: 'Premium flakes for tropical fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Tetra'] || brandMap['TetraMin'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Tropical+Flakes'],
        isActive: true
      },
      {
        name: 'Taiyo Goldfish Food',
        description: 'Nutritious flakes for goldfish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Taiyo'] || defaultBrand,
        mrp: 180,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Taiyo+Food'],
        isActive: true
      },
      {
        name: 'Tetra Betta Food',
        description: 'Special formula for betta fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Tetra'] || brandMap['TetraMin'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Betta+Food'],
        isActive: true
      },
      {
        name: 'Taiyo Pluset Growth Fish Food',
        description: 'Growth enhancing pellets',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Taiyo'] || defaultBrand,
        mrp: 250,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Growth+Food'],
        isActive: true
      },
      {
        name: 'Tetra Color Granules',
        description: 'Color enhancing granules',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: brandMap['Tetra'] || brandMap['TetraMin'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Color+Food'],
        isActive: true
      },

      // FISH MEDICINE (5 products)
      {
        name: 'API Stress Coat',
        description: 'Water conditioner and stress relief',
        mainCategory: 'Fish',
        subCategory: 'Fish Medicine',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4FFE8/3498DB?text=Stress+Coat'],
        isActive: true
      },
      {
        name: 'API Aquarium Salt',
        description: 'Promotes fish health',
        mainCategory: 'Fish',
        subCategory: 'Fish Medicine',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4FFE8/3498DB?text=Aquarium+Salt'],
        isActive: true
      },
      {
        name: 'API Melafix',
        description: 'Natural bacterial infection treatment',
        mainCategory: 'Fish',
        subCategory: 'Fish Medicine',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4FFE8/3498DB?text=Melafix'],
        isActive: true
      },
      {
        name: 'API Ich Cure',
        description: 'Treatment for ich disease',
        mainCategory: 'Fish',
        subCategory: 'Fish Medicine',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 480,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4FFE8/3498DB?text=Ich+Cure'],
        isActive: true
      },
      {
        name: 'API Fungus Cure',
        description: 'Treats fungal infections',
        mainCategory: 'Fish',
        subCategory: 'Fish Medicine',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4FFE8/3498DB?text=Fungus+Cure'],
        isActive: true
      },

      // FISH ACCESSORIES (5 products)
      {
        name: 'Aqua One Fish Net',
        description: 'Fine mesh fish net',
        mainCategory: 'Fish',
        subCategory: 'Fish Accessories',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 180,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/1ABC9C?text=Fish+Net'],
        isActive: true
      },
      {
        name: 'Aqua One Magnetic Algae Cleaner',
        description: 'Cleans inside tank glass',
        mainCategory: 'Fish',
        subCategory: 'Fish Accessories',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 650,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/1ABC9C?text=Algae+Cleaner'],
        isActive: true
      },
      {
        name: 'Aqua One Thermometer',
        description: 'Digital aquarium thermometer',
        mainCategory: 'Fish',
        subCategory: 'Fish Accessories',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/1ABC9C?text=Thermometer'],
        isActive: true
      },
      {
        name: 'Aqua One Gravel Cleaner',
        description: 'Siphon for cleaning gravel',
        mainCategory: 'Fish',
        subCategory: 'Fish Accessories',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 480,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/1ABC9C?text=Gravel+Cleaner'],
        isActive: true
      },
      {
        name: 'Trixie Aquarium Decorations',
        description: 'Artificial plants and ornaments',
        mainCategory: 'Fish',
        subCategory: 'Fish Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/1ABC9C?text=Decorations'],
        isActive: true
      },

      // FISH TANK SUPPLIES (5 products)
      {
        name: 'Aqua One Internal Filter',
        description: 'Powerful internal filtration',
        mainCategory: 'Fish',
        subCategory: 'Fish Tank Supplies',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 1200,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/16A085?text=Filter'],
        isActive: true
      },
      {
        name: 'Aqua One LED Aquarium Light',
        description: 'Energy efficient LED light',
        mainCategory: 'Fish',
        subCategory: 'Fish Tank Supplies',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 2200,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/16A085?text=LED+Light'],
        isActive: true
      },
      {
        name: 'API Water Conditioner',
        description: 'Removes chlorine and chloramine',
        mainCategory: 'Fish',
        subCategory: 'Fish Tank Supplies',
        brand_id: brandMap['API a'] || brandMap['API'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4E5FF/16A085?text=Conditioner'],
        isActive: true
      },
      {
        name: 'Aqua One Air Pump',
        description: 'Silent air pump for aerating',
        mainCategory: 'Fish',
        subCategory: 'Fish Tank Supplies',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 850,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/16A085?text=Air+Pump'],
        isActive: true
      },
      {
        name: 'Aqua One Aquarium Heater',
        description: 'Adjustable heater for tropical tanks',
        mainCategory: 'Fish',
        subCategory: 'Fish Tank Supplies',
        brand_id: brandMap['Aqua One'] || defaultBrand,
        mrp: 950,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/16A085?text=Heater'],
        isActive: true
      },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐦 CREATING BIRD PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const birdProducts = [
      // BIRD FOOD (6 products)
      {
        name: 'Vitapol Budgie Food',
        description: 'Complete food for budgerigars',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Budgie+Food'],
        isActive: true
      },
      {
        name: 'Taiyo Parrot Food',
        description: 'Nutritious mix for parrots',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: brandMap['Taiyo'] || defaultBrand,
        mrp: 350,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Parrot+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Canary Food',
        description: 'Premium food for canaries',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 260,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Canary+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Lovebird Food',
        description: 'Balanced diet for lovebirds',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 290,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Lovebird+Food'],
        isActive: true
      },
      {
        name: 'Taiyo Seed Mix for Birds',
        description: 'Mixed seeds for all birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
       brand_id: brandMap['Taiyo'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Seed+Mix'],
        isActive: true
      },
      {
        name: 'Vitapol Cockatiel Food',
        description: 'Specially formulated for cockatiels',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Cockatiel+Food'],
        isActive: true
      },

      // BIRD MEDICINE (5 products)
      {
        name: 'Beaphar Bird Tonic',
        description: 'Multivitamin supplement for birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4E5/E74C3C?text=Bird+Tonic'],
        isActive: true
      },
      {
        name: 'Beaphar Mite Spray',
        description: 'Effective mite treatment',
        mainCategory: 'Bird',
        subCategory: 'Bird Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4E5/E74C3C?text=Mite+Spray'],
        isActive: true
      },
      {
        name: 'Vitapol Mineral Block',
        description: 'Calcium and mineral supplement',
        mainCategory: 'Bird',
        subCategory: 'Bird Medicine',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 150,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFD4E5/E74C3C?text=Mineral+Block'],
        isActive: true
      },
      {
        name: 'Beaphar Feather Care',
        description: 'Promotes healthy feathers',
        mainCategory: 'Bird',
        subCategory: 'Bird Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4E5/E74C3C?text=Feather+Care'],
        isActive: true
      },
      {
        name: 'Vitapol Cuttlebone',
        description: 'Natural calcium source',
        mainCategory: 'Bird',
        subCategory: 'Bird Medicine',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 120,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFD4E5/E74C3C?text=Cuttlebone'],
        isActive: true
      },

      // BIRD ACCESSORIES (5 products)
      {
        name: 'Trixie Bird Cage',
        description: 'Spacious cage for medium birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 3500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Bird+Cage'],
        isActive: true
      },
      {
        name: 'Trixie Wooden Perch',
        description: 'Natural wooden perch',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Perch'],
        isActive: true
      },
      {
        name: 'Trixie Bird Bath',
        description: 'Hanging bird bath',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Bird+Bath'],
        isActive: true
      },
      {
        name: 'Trixie Feeding Bowl Set',
        description: 'Clip-on food and water bowls',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Bowls'],
        isActive: true
      },
      {
        name: 'Trixie Bird Nest',
        description: 'Cozy nesting box',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Nest'],
        isActive: true
      },

      // BIRD TOYS (5 products)
      {
        name: 'Trixie Bird Swing',
        description: 'Wooden swing for birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/2ECC71?text=Bird+Swing'],
        isActive: true
      },
      {
        name: 'Trixie Bird Mirror',
        description: 'Mirror toy with bell',
        mainCategory: 'Bird',
        subCategory: 'Bird Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 180,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/2ECC71?text=Mirror'],
        isActive: true
      },
      {
        name: 'Trixie Climbing Rope',
        description: 'Colorful rope for climbing',
        mainCategory: 'Bird',
        subCategory: 'Bird Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/2ECC71?text=Rope'],
        isActive: true
      },
      {
        name: 'Trixie Bell Toy',
        description: 'Hanging bell toy',
        mainCategory: 'Bird',
        subCategory: 'Bird Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 150,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/2ECC71?text=Bell'],
        isActive: true
      },
      {
        name: 'Trixie Foraging Toy',
        description: 'Interactive foraging toy',
        mainCategory: 'Bird',
        subCategory: 'Bird Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFD4/2ECC71?text=Foraging+Toy'],
        isActive: true
      },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐹 CREATING SMALL ANIMAL PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const smallAnimalProducts = [
      // SMALL ANIMAL FOOD (6 products)
      {
        name: 'Vitapol Rabbit Food',
        description: 'Complete nutrition for rabbits',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Rabbit+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Hamster Food',
        description: 'Balanced diet for hamsters',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Hamster+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Guinea Pig Food',
        description: 'Vitamin C rich food',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Guinea+Pig'],
        isActive: true
      },
      {
        name: 'Vitapol Chinchilla Food',
        description: 'Premium food for chinchillas',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Chinchilla'],
        isActive: true
      },
      {
        name: 'Vitapol Gerbil Food',
        description: 'Nutritious mix for gerbils',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 240,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Gerbil+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Rabbit Hay',
        description: 'Timothy hay for rabbits',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 450,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Hay'],
        isActive: true
      },

      // SMALL ANIMAL MEDICINE (5 products)
      {
        name: 'Beaphar Small Animal Vitamin Drops',
        description: 'Essential vitamins for small pets',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Vitamins'],
        isActive: true
      },
      {
        name: 'Beaphar Anti-Parasite Spot On',
        description: 'Flea and tick treatment',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Spot+On'],
        isActive: true
      },
      {
        name: 'Vitapol Mineral Stone',
        description: 'Natural mineral supplement',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Medicine',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 180,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Mineral+Stone'],
        isActive: true
      },
      {
        name: 'Beaphar Digestive Support',
        description: 'Probiotic for small animals',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Medicine',
        brand_id: brandMap['Beaphar'] || defaultBrand,
        mrp: 350,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Probiotic'],
        isActive: true
      },
      {
        name: 'Vitapol Dental Care Sticks',
        description: 'Helps maintain healthy teeth',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Medicine',
        brand_id: brandMap['Vitapol'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Dental+Sticks'],
        isActive: true
      },

      // SMALL ANIMAL ACCESSORIES (6 products)
      {
        name: 'Trixie Rabbit Hutch',
        description: 'Spacious wooden hutch',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 5500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Rabbit+Hutch'],
        isActive: true
      },
      {
        name: 'Trixie Hamster Cage',
        description: 'Complete hamster habitat',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 2200,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Hamster+Cage'],
        isActive: true
      },
      {
        name: 'Trixie Water Bottle',
        description: 'Drip-free water bottle',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Water+Bottle'],
        isActive: true
      },
      {
        name: 'Trixie Ceramic Food Bowl',
        description: 'Heavy ceramic bowl',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Bowl'],
        isActive: true
      },
      {
        name: 'Trixie Hay Rack',
        description: 'Keeps hay fresh and clean',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Hay+Rack'],
        isActive: true
      },
      {
        name: 'Trixie Hideout House',
        description: 'Wooden hideaway for small pets',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 650,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Hideout'],
        isActive: true
      },

      // SMALL ANIMAL TOYS (5 products)
      {
        name: 'Trixie Exercise Wheel',
        description: 'Silent running wheel',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFE8/2ECC71?text=Wheel'],
        isActive: true
      },
      {
        name: 'Trixie Play Tunnel',
        description: 'Expandable play tunnel',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 420,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFE8/2ECC71?text=Tunnel'],
        isActive: true
      },
      {
        name: 'Trixie Wooden Chew Toy',
        description: 'Natural wood for chewing',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 220,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFE8/2ECC71?text=Chew+Toy'],
        isActive: true
      },
      {
        name: 'Trixie Hamster Ball',
        description: 'Exercise ball for hamsters',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFE8/2ECC71?text=Hamster+Ball'],
        isActive: true
      },
      {
        name: 'Trixie Grass Mat',
        description: 'Natural grass mat for digging',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Toys',
        brand_id: brandMap['Trixie'] || defaultBrand,
        mrp: 320,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4FFE8/2ECC71?text=Grass+Mat'],
        isActive: true
      },
    ];

    // Combine all products
    const allProducts = [
      ...dogProducts,
      ...catProducts,
      ...fishProducts,
      ...birdProducts,
      ...smallAnimalProducts
    ];

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 INSERTING ALL PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const result = await Product.insertMany(allProducts);
    console.log(`✅ Successfully inserted ${result.length} products!\n`);

    // Show summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PRODUCTS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const categories = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];
    
    for (const mainCat of categories) {
      const count = await Product.countDocuments({ 
        mainCategory: mainCat,
        isActive: true 
      });
      console.log(`${mainCat}: ${count} products`);
      
      const subCategories = await Product.distinct('subCategory', {
        mainCategory: mainCat,
        isActive: true
      });
      
      for (const subCat of subCategories) {
        const subCount = await Product.countDocuments({ 
          mainCategory: mainCat,
          subCategory: subCat,
          isActive: true 
        });
        console.log(`   └─ ${subCat}: ${subCount} products`);
      }
      console.log();
    }

    await mongoose.disconnect();
    console.log('✅ All done! Database is ready with fresh products!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAllProducts();
