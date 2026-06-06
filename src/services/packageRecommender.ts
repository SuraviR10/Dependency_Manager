/**
 * Package Recommender
 * Suggests packages for common imports before they cause runtime errors
 */

import { SupportedLanguage } from '../types/types';

export interface PackageRecommendation {
  importName: string;
  packageName: string;
  description: string;
  installCommand: string;
  documentation?: string;
  popularity: number; // 0-100
}

export class PackageRecommender {
  private pythonMappings: Map<string, PackageRecommendation> = new Map();
  private nodeMappings: Map<string, PackageRecommendation> = new Map();

  constructor() {
    this.initializePythonMappings();
    this.initializeNodeMappings();
  }

  /**
   * Get recommendation for an import
   */
  public getRecommendation(
    importName: string,
    language: SupportedLanguage
  ): PackageRecommendation | undefined {
    if (language === SupportedLanguage.Python) {
      return this.pythonMappings.get(importName.toLowerCase());
    } else if (language === SupportedLanguage.NodeJS) {
      return this.nodeMappings.get(importName.toLowerCase());
    }
    return undefined;
  }

  /**
   * Initialize Python import -> package mappings
   */
  private initializePythonMappings(): void {
    const mappings: PackageRecommendation[] = [
      {
        importName: 'cv2',
        packageName: 'opencv-python',
        description: 'Computer vision and image processing library',
        installCommand: 'pip install opencv-python',
        documentation: 'https://docs.opencv.org/',
        popularity: 95,
      },
      {
        importName: 'sklearn',
        packageName: 'scikit-learn',
        description: 'Machine learning library with classification, regression, and clustering',
        installCommand: 'pip install scikit-learn',
        documentation: 'https://scikit-learn.org/',
        popularity: 98,
      },
      {
        importName: 'PIL',
        packageName: 'Pillow',
        description: 'Python Imaging Library for image processing',
        installCommand: 'pip install Pillow',
        documentation: 'https://pillow.readthedocs.io/',
        popularity: 92,
      },
      {
        importName: 'bs4',
        packageName: 'beautifulsoup4',
        description: 'Web scraping library for parsing HTML and XML',
        installCommand: 'pip install beautifulsoup4',
        documentation: 'https://www.crummy.com/software/BeautifulSoup/',
        popularity: 90,
      },
      {
        importName: 'requests',
        packageName: 'requests',
        description: 'HTTP library for making requests',
        installCommand: 'pip install requests',
        documentation: 'https://requests.readthedocs.io/',
        popularity: 99,
      },
      {
        importName: 'numpy',
        packageName: 'numpy',
        description: 'Numerical computing library with array and matrix support',
        installCommand: 'pip install numpy',
        documentation: 'https://numpy.org/',
        popularity: 99,
      },
      {
        importName: 'pandas',
        packageName: 'pandas',
        description: 'Data manipulation and analysis library',
        installCommand: 'pip install pandas',
        documentation: 'https://pandas.pydata.org/',
        popularity: 98,
      },
      {
        importName: 'matplotlib',
        packageName: 'matplotlib',
        description: 'Plotting and visualization library',
        installCommand: 'pip install matplotlib',
        documentation: 'https://matplotlib.org/',
        popularity: 96,
      },
      {
        importName: 'tensorflow',
        packageName: 'tensorflow',
        description: 'Deep learning and machine learning framework',
        installCommand: 'pip install tensorflow',
        documentation: 'https://www.tensorflow.org/',
        popularity: 95,
      },
      {
        importName: 'torch',
        packageName: 'torch',
        description: 'PyTorch deep learning framework',
        installCommand: 'pip install torch',
        documentation: 'https://pytorch.org/',
        popularity: 94,
      },
      {
        importName: 'flask',
        packageName: 'flask',
        description: 'Lightweight web framework for building APIs and web apps',
        installCommand: 'pip install flask',
        documentation: 'https://flask.palletsprojects.com/',
        popularity: 95,
      },
      {
        importName: 'django',
        packageName: 'django',
        description: 'Full-featured web framework',
        installCommand: 'pip install django',
        documentation: 'https://www.djangoproject.com/',
        popularity: 94,
      },
      {
        importName: 'fastapi',
        packageName: 'fastapi',
        description: 'Modern web framework for building fast APIs',
        installCommand: 'pip install fastapi',
        documentation: 'https://fastapi.tiangolo.com/',
        popularity: 90,
      },
      {
        importName: 'sqlalchemy',
        packageName: 'sqlalchemy',
        description: 'SQL toolkit and Object Relational Mapper',
        installCommand: 'pip install sqlalchemy',
        documentation: 'https://www.sqlalchemy.org/',
        popularity: 92,
      },
      {
        importName: 'dotenv',
        packageName: 'python-dotenv',
        description: 'Load environment variables from .env files',
        installCommand: 'pip install python-dotenv',
        documentation: 'https://github.com/theskumar/python-dotenv',
        popularity: 88,
      },
      {
        importName: 'yaml',
        packageName: 'PyYAML',
        description: 'YAML parser and emitter for Python',
        installCommand: 'pip install PyYAML',
        documentation: 'https://pyyaml.org/',
        popularity: 85,
      },
      {
        importName: 'jwt',
        packageName: 'PyJWT',
        description: 'JSON Web Token library',
        installCommand: 'pip install PyJWT',
        documentation: 'https://pyjwt.readthedocs.io/',
        popularity: 85,
      },
      {
        importName: 'selenium',
        packageName: 'selenium',
        description: 'Browser automation and testing',
        installCommand: 'pip install selenium',
        documentation: 'https://selenium.dev/',
        popularity: 88,
      },
      {
        importName: 'pytest',
        packageName: 'pytest',
        description: 'Testing framework for writing test cases',
        installCommand: 'pip install pytest',
        documentation: 'https://pytest.org/',
        popularity: 96,
      },
      {
        importName: 'click',
        packageName: 'click',
        description: 'CLI creation library',
        installCommand: 'pip install click',
        documentation: 'https://click.palletsprojects.com/',
        popularity: 85,
      },
    ];

    for (const mapping of mappings) {
      this.pythonMappings.set(mapping.importName.toLowerCase(), mapping);
    }
  }

  /**
   * Initialize Node.js import -> package mappings
   */
  private initializeNodeMappings(): void {
    const mappings: PackageRecommendation[] = [
      {
        importName: 'express',
        packageName: 'express',
        description: 'Web application framework for Node.js',
        installCommand: 'npm install express',
        documentation: 'https://expressjs.com/',
        popularity: 99,
      },
      {
        importName: 'axios',
        packageName: 'axios',
        description: 'Promise-based HTTP client',
        installCommand: 'npm install axios',
        documentation: 'https://axios-http.com/',
        popularity: 97,
      },
      {
        importName: 'lodash',
        packageName: 'lodash',
        description: 'Utility library for working with arrays, objects, etc.',
        installCommand: 'npm install lodash',
        documentation: 'https://lodash.com/',
        popularity: 96,
      },
      {
        importName: 'mongoose',
        packageName: 'mongoose',
        description: 'MongoDB object modeling for Node.js',
        installCommand: 'npm install mongoose',
        documentation: 'https://mongoosejs.com/',
        popularity: 92,
      },
      {
        importName: 'dotenv',
        packageName: 'dotenv',
        description: 'Load environment variables from .env files',
        installCommand: 'npm install dotenv',
        documentation: 'https://github.com/motdotla/dotenv',
        popularity: 95,
      },
      {
        importName: 'moment',
        packageName: 'moment',
        description: 'Date library for parsing, validating, and formatting dates',
        installCommand: 'npm install moment',
        documentation: 'https://momentjs.com/',
        popularity: 93,
      },
      {
        importName: 'chalk',
        packageName: 'chalk',
        description: 'Terminal string styling',
        installCommand: 'npm install chalk',
        documentation: 'https://github.com/chalk/chalk',
        popularity: 88,
      },
      {
        importName: 'jest',
        packageName: 'jest',
        description: 'Testing framework',
        installCommand: 'npm install --save-dev jest',
        documentation: 'https://jestjs.io/',
        popularity: 97,
      },
      {
        importName: 'webpack',
        packageName: 'webpack',
        description: 'Module bundler',
        installCommand: 'npm install --save-dev webpack',
        documentation: 'https://webpack.js.org/',
        popularity: 94,
      },
      {
        importName: 'typescript',
        packageName: 'typescript',
        description: 'TypeScript language support',
        installCommand: 'npm install --save-dev typescript',
        documentation: 'https://www.typescriptlang.org/',
        popularity: 96,
      },
      {
        importName: 'react',
        packageName: 'react',
        description: 'JavaScript library for building user interfaces',
        installCommand: 'npm install react react-dom',
        documentation: 'https://react.dev/',
        popularity: 99,
      },
      {
        importName: 'vue',
        packageName: 'vue',
        description: 'Progressive JavaScript framework',
        installCommand: 'npm install vue',
        documentation: 'https://vuejs.org/',
        popularity: 92,
      },
      {
        importName: 'next',
        packageName: 'next',
        description: 'React framework with SSR and static generation',
        installCommand: 'npm install next',
        documentation: 'https://nextjs.org/',
        popularity: 93,
      },
      {
        importName: 'tailwindcss',
        packageName: 'tailwindcss',
        description: 'Utility-first CSS framework',
        installCommand: 'npm install --save-dev tailwindcss',
        documentation: 'https://tailwindcss.com/',
        popularity: 94,
      },
      {
        importName: 'prettier',
        packageName: 'prettier',
        description: 'Code formatter',
        installCommand: 'npm install --save-dev prettier',
        documentation: 'https://prettier.io/',
        popularity: 94,
      },
      {
        importName: 'eslint',
        packageName: 'eslint',
        description: 'JavaScript linter',
        installCommand: 'npm install --save-dev eslint',
        documentation: 'https://eslint.org/',
        popularity: 95,
      },
    ];

    for (const mapping of mappings) {
      this.nodeMappings.set(mapping.importName.toLowerCase(), mapping);
    }
  }

  /**
   * Get top recommendations (most popular packages)
   */
  public getTopRecommendations(
    language: SupportedLanguage,
    count: number = 10
  ): PackageRecommendation[] {
    const mappings = language === SupportedLanguage.Python
      ? Array.from(this.pythonMappings.values())
      : Array.from(this.nodeMappings.values());

    return mappings
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, count);
  }
}
