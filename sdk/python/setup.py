from setuptools import setup

setup(
    name='devinsight',
    version='1.0.0',
    description='Auto-capture runtime errors and send diagnostics to DevInsight API',
    long_description=open('README.md').read() if __import__('os').path.exists('README.md') else '',
    long_description_content_type='text/markdown',
    py_modules=['devinsight'],
    python_requires='>=3.8',
    license='MIT',
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
)
