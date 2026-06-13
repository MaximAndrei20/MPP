import { faker } from '@faker-js/faker';

// Seed faker to ensure consistent generation on load
faker.seed(42);

const ARTICLE_TEMPLATES = [
  {
    title: "The Thermodynamics of Inspiration: Heat Dissipation and Cognitive Breakthroughs",
    category: "Thermodynamics",
    image: "/images/sweat_science.png",
    subCategory: "Biophysical Cognition",
    metrics: { coefficient: 0.85, somatic: 92, academicHeat: 8.4 }
  },
  {
    title: "Deodorant and Deconstruction: A Critique of Somatic Suppression in Modernist Philosophy",
    category: "Philosophy",
    image: "/images/perspiration_philosophy.png",
    subCategory: "Phenomenology",
    metrics: { coefficient: 0.45, somatic: 48, academicHeat: 9.1 }
  },
  {
    title: "Sweat Equity: Towards a Perspirational Valuation of Speculative Labor",
    category: "Economics",
    image: "/images/effort_economics.png",
    subCategory: "Labor Theory of Value",
    metrics: { coefficient: 0.95, somatic: 97, academicHeat: 7.9 }
  },
  {
    title: "Hyperhidrosis and Histrionics: The Somatosensory Architecture of Stage Fright",
    category: "Psychology",
    image: "/images/somatic_psychology.png",
    subCategory: "Clinical Somatics",
    metrics: { coefficient: 0.78, somatic: 85, academicHeat: 8.8 }
  },
  {
    title: "The Molecular Signature of Effort: Chromatography of Intellectual Perspiration",
    category: "Thermodynamics",
    image: "/images/sweat_science.png",
    subCategory: "Analytical Chemistry",
    metrics: { coefficient: 0.91, somatic: 89, academicHeat: 8.1 }
  },
  {
    title: "Sweating the Small Stuff: Micro-Perspiration as a Marker of Cognitive Dissonance",
    category: "Psychology",
    image: "/images/somatic_psychology.png",
    subCategory: "Cognitive Neurobiology",
    metrics: { coefficient: 0.62, somatic: 70, academicHeat: 6.9 }
  },
  {
    title: "Steam and Statehood: The Geopolitics of Fin-de-Siècle Turkish Baths",
    category: "Philosophy",
    image: "/images/perspiration_philosophy.png",
    subCategory: "Historical Materialism",
    metrics: { coefficient: 0.50, somatic: 60, academicHeat: 7.5 }
  },
  {
    title: "Exudative Capitalism: Analyzing the Metaphorical Sweating of the Working Class",
    category: "Economics",
    image: "/images/effort_economics.png",
    subCategory: "Marxian Economics",
    metrics: { coefficient: 0.88, somatic: 94, academicHeat: 8.7 }
  }
];

export function generateArticles() {
  return ARTICLE_TEMPLATES.map((template, idx) => {
    // Generate paragraphs
    const paragraphsCount = faker.number.int({ min: 3, max: 5 });
    const paragraphs = Array.from({ length: paragraphsCount }, () => {
      // Create highly academic-sounding paragraphs using lorem and inject words
      const text = faker.lorem.paragraph(faker.number.int({ min: 5, max: 9 }));
      const thematicJargon = [
        "perspiratory gland response",
        "thermal-cognitive nexus",
        "sweat-induced epidermal conductivity",
        "exudative somatic feedback",
        "hyper-thermal intellectual output",
        "glandular micro-secretion",
        "homeostatic mental exertion"
      ];
      const words = text.split(" ");
      for (let i = 0; i < words.length; i += 20) {
        if (i > 0 && i < words.length) {
          words[i] = thematicJargon[(idx + i) % thematicJargon.length];
        }
      }
      return words.join(" ");
    });

    // Generate citations
    const citationCount = faker.number.int({ min: 3, max: 5 });
    const citations = Array.from({ length: citationCount }, () => {
      const author = faker.person.lastName();
      const initial = faker.person.firstName().charAt(0);
      const year = faker.date.past({ years: 15 }).getFullYear();
      const journal = faker.helpers.arrayElement([
        "Journal of Thermal Humanities",
        "International Journal of Glandular Studies",
        "Annals of Somatic Philosophy",
        "Perspiration Quarterly",
        "Review of Exudative Economics"
      ]);
      const volume = faker.number.int({ min: 1, max: 50 });
      const issue = faker.number.int({ min: 1, max: 4 });
      const pages = `${faker.number.int({ min: 10, max: 100 })}-${faker.number.int({ min: 101, max: 200 })}`;
      return `${author}, ${initial}. (${year}). ${faker.lorem.sentence().replace(".", "")}. *${journal}*, ${volume}(${issue}), ${pages}.`;
    });

    // Generate Peer Reviews / Comments
    const reviewsCount = faker.number.int({ min: 2, max: 4 });
    const peerReviews = Array.from({ length: reviewsCount }, () => {
      return {
        id: faker.string.uuid(),
        reviewer: `Dr. ${faker.person.fullName()}`,
        institution: `${faker.company.name()} University`,
        date: faker.date.past({ years: 1 }).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' }),
        avatar: faker.image.avatar(),
        sentiment: faker.helpers.arrayElement(["Approved with minor revisions", "Highly Recommended", "Controversial but Significant"]),
        comment: faker.lorem.paragraph(2)
      };
    });

    const readingTime = Math.ceil(paragraphs.join(" ").split(" ").length / 200);

    return {
      id: `art-${idx + 1}`,
      title: template.title,
      category: template.category,
      subCategory: template.subCategory,
      image: template.image,
      abstract: faker.lorem.sentences(faker.number.int({ min: 2, max: 3 })),
      paragraphs,
      metrics: template.metrics,
      citations,
      peerReviews,
      readingTime: `${readingTime} min read`,
      date: faker.date.past({ years: 1 }).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' }),
      author: {
        name: `Prof. Dr. ${faker.person.fullName()}`,
        title: `Chair of ${template.subCategory}`,
        institution: `Institutul Superior de Transpirație Teoretică`,
        avatar: faker.image.avatar()
      }
    };
  });
}
