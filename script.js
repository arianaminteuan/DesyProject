    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      document.body.classList.toggle('menu-open');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        document.body.classList.remove('menu-open');
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const counters = document.querySelectorAll('[data-count]');
    let counted = false;

    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !counted) {
          counted = true;
          counters.forEach(counter => {
            const target = +counter.dataset.count;
            let current = 0;
            const increment = Math.max(1, Math.ceil(target / 40));

            const updateCounter = () => {
              current += increment;
              if (current >= target) {
                counter.textContent = target + '+';
              } else {
                counter.textContent = current;
                requestAnimationFrame(updateCounter);
              }
            };

            updateCounter();
          });
        }
      });
    }, { threshold: 0.4 });

    if (document.querySelector('.stats')) {
      countObserver.observe(document.querySelector('.stats'));
    }

    const filterButtons = document.querySelectorAll('.filter-btn');
    const publicationCards = document.querySelectorAll('.pub-card');

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const filter = button.dataset.filter;

        publicationCards.forEach(card => {
          const show = filter === 'all' || card.dataset.category === filter;
          card.style.display = show ? 'block' : 'none';
        });
      });
    });

    const sections = document.querySelectorAll('section[id]');
    const navAnchors = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (scrollY >= sectionTop) current = section.getAttribute('id');
      });

      navAnchors.forEach(anchor => {
        anchor.classList.remove('active');
        if (anchor.getAttribute('href') === `#${current}`) {
          anchor.classList.add('active');
        }
      });
    });

  (function () {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
    }

    document.addEventListener("DOMContentLoaded", function () {
      const toggleButton = document.getElementById("theme-toggle");
      const toggleText = document.querySelector(".theme-toggle-text");

      function updateToggleLabel() {
        const isDark = document.body.classList.contains("dark-mode");
        if (toggleText) {
          toggleText.textContent = isDark ? "Light Mode" : "Dark Mode";
        }
      }

      if (toggleButton) {
        updateToggleLabel();

        toggleButton.addEventListener("click", function () {
          document.body.classList.toggle("dark-mode");
          const isDark = document.body.classList.contains("dark-mode");
          localStorage.setItem("theme", isDark ? "dark" : "light");
          updateToggleLabel();
        });
      }
    });
  })();