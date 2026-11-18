// Saved run of the Laplacian demo at the search-optimal settings (fetched 2026-11-18 from the live API),
// shown before a visitor presses Run. Brain-surface renders live in public/research/laplacian-glm/.
export const DEFAULT_PARAMS = { lambda: 2.66, nEigenvectors: 1000, pVal: '6.45e-5', clusterThreshold: 19 };
export const SAVED_RESULTS = {
  "combined": 0.2097820004976704,
  "datasets": {
    "localizer": {
      "label": "Localizer (Pinel)",
      "score": 0.07199016034222051,
      "dims": {
        "generalization": 0.23251821841510192,
        "recovery": -0.08877204789520239,
        "reproducibility": 0.12780462442576998,
        "hrf_consistency": 0.016409846423212533
      },
      "contrasts": {
        "(left - right) button press": {
          "ols": {
            "sig_positive": 93,
            "sig_negative": 167,
            "peak_z": 8.496521434236797
          },
          "reg": {
            "sig_positive": 0,
            "sig_negative": 88,
            "peak_z": 6.159485429600424
          }
        },
        "audio - visual": {
          "ols": {
            "sig_positive": 341,
            "sig_negative": 555,
            "peak_z": 9.284176372707826
          },
          "reg": {
            "sig_positive": 192,
            "sig_negative": 123,
            "peak_z": 7.624449464732319
          }
        },
        "computation - sentences": {
          "ols": {
            "sig_positive": 0,
            "sig_negative": 0,
            "peak_z": 5.24313987616443
          },
          "reg": {
            "sig_positive": 0,
            "sig_negative": 0,
            "peak_z": 4.004959398738901
          }
        }
      }
    },
    "spm_auditory": {
      "label": "SPM Auditory",
      "score": 0.30194278825116855,
      "dims": {
        "generalization": 0.3160535695039336,
        "recovery": -0.1420827956127999,
        "reproducibility": 1.0426570335667484,
        "hrf_consistency": -0.008856654453207831
      },
      "contrasts": {
        "listening": {
          "ols": {
            "sig_positive": 197,
            "sig_negative": 0,
            "peak_z": 22.358710508378284
          },
          "reg": {
            "sig_positive": 218,
            "sig_negative": 21,
            "peak_z": 20.719200505268464
          }
        }
      }
    },
    "spm_multimodal": {
      "label": "SPM Multimodal",
      "score": 0.25541305289962224,
      "dims": {
        "generalization": 0.34176055582986237,
        "recovery": -0.024266110340436818,
        "reproducibility": 0.686730665695356,
        "hrf_consistency": 0.017427100413707448
      },
      "contrasts": {
        "faces - scrambled": {
          "ols": {
            "sig_positive": 25,
            "sig_negative": 0,
            "peak_z": 9.001067913082794
          },
          "reg": {
            "sig_positive": 23,
            "sig_negative": 0,
            "peak_z": 8.532437502367758
          }
        }
      }
    }
  },
  "selected": {
    "lambda": 2.66,
    "n_eigenvectors": 1000,
    "p_val": 6.45e-05,
    "cluster_threshold": 19
  }
};
export const SAVED_IMAGES = {
  "localizer": {
    "(left - right) button press": "/research/laplacian-glm/localizer-left-right.png",
    "audio - visual": "/research/laplacian-glm/localizer-audio-visual.png",
    "computation - sentences": "/research/laplacian-glm/localizer-computation-sentences.png"
  },
  "spm_auditory": {
    "listening": "/research/laplacian-glm/spm-auditory-listening.png"
  },
  "spm_multimodal": {
    "faces - scrambled": "/research/laplacian-glm/spm-multimodal-faces-scrambled.png"
  }
};
// Combined improvement over OLS (%) as the eigenbasis grows (research/results/k_sensitivity.json, sampled).
export const K_SWEEP = [[20, 7.08], [40, 8.27], [60, 7.66], [100, 7.94], [160, 10.64], [200, 11.24], [300, 14.45], [400, 15.89], [500, 16.51], [600, 16.92], [700, 17.32], [800, 19.18], [900, 19.55], [1000, 20.85], [1200, 21.15], [1500, 23.26], [2000, 25.53], [2500, 27.01], [3000, 28.22], [4000, 28.37], [5000, 32.94], [6000, 34.76], [8000, 37.89], [10000, 40.37], [12000, 43.17], [15000, 46.18], [18000, 41.99], [20000, 45.17], [20482, 50.02]];
export const METRICS = [
  ['generalization', 'Generalization', 'Error on the held-out last 20% of time points'],
  ['reproducibility', 'Reproducibility', 'Odd vs. even time-point maps'],
  ['hrf_consistency', 'HRF Consistency', 'R² at significant vertices'],
  ['recovery', 'Recovery', 'Semi-synthetic ground truth'],
];
